import argparse
import json
from pathlib import Path
from typing import Iterable

import easyocr
import numpy as np
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = REPO_ROOT / 'server' / 'ml' / 'models'
HOME_RUNS_ROOT = Path.home() / 'runs'


def resolve_existing_path(raw_path: str, search_roots: Iterable[Path]) -> Path | None:
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate

    for root in search_roots:
        resolved = root / raw_path
        if resolved.exists():
            return resolved

    return None


def resolve_image_path(raw_path: str) -> Path | None:
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate

    basename = Path(raw_path).name
    search_roots = [
        Path.cwd(),
        Path.cwd().parent,
        Path(__file__).resolve().parent,
        Path(__file__).resolve().parent.parent,
        REPO_ROOT,
        REPO_ROOT / 'server',
        REPO_ROOT / 'server' / 'uploads',
        REPO_ROOT / 'uploads'
    ]

    resolved = resolve_existing_path(raw_path, search_roots)
    if resolved:
        return resolved

    for root in search_roots:
        fallback = root / basename
        if fallback.exists():
            return fallback

    return None


def resolve_weights_path(raw_path: str) -> Path | None:
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate

    search_roots = [
        Path.cwd(),
        Path.cwd().parent,
        Path(__file__).resolve().parent,
        Path(__file__).resolve().parent.parent,
        REPO_ROOT,
        REPO_ROOT / 'server',
        MODEL_ROOT,
        HOME_RUNS_ROOT,
        HOME_RUNS_ROOT / 'detect'
    ]

    resolved = resolve_existing_path(raw_path, search_roots)
    if resolved:
        return resolved

    requested_name = Path(raw_path).name.lower()
    requested_parent = Path(raw_path).parent.name.lower()

    if requested_name != 'best.pt':
        return None

    matches = [
        path
        for path in MODEL_ROOT.glob('**/best.pt')
        if requested_parent in {'', '.', 'weights'}
        or requested_parent in path.as_posix().lower()
        or Path(path).parent.parent.name.lower().startswith(requested_parent)
        or Path(path).parent.name.lower().startswith(requested_parent)
    ]

    if not matches:
        matches = list(MODEL_ROOT.glob('**/best.pt'))

    if not matches:
        matches = list(HOME_RUNS_ROOT.glob('detect/**/best.pt'))

    if not matches:
        matches = list(HOME_RUNS_ROOT.glob('**/best.pt'))

    if not matches:
        return None

    return max(matches, key=lambda item: item.stat().st_mtime)


def normalize_key(raw_name: str) -> str | None:
    name = raw_name.strip().lower()
    if name == "pan number":
        return "panNumber"
    if name == "name":
        return "name"
    if name in {"father name", "father"}:
        return "fatherName"
    if name in {"dob", "yob"}:
        return "dob"
    if name in {"aadhaar number", "aadhaar no", "aadhar number", "aadhar no", "uid", "uid number"}:
        return "aadhaarNumber"
    if name == "gender":
        return "gender"
    if name == "address":
        return "address"
    return None


def crop_image(np_image: np.ndarray, xyxy: list[float]) -> np.ndarray:
    x1, y1, x2, y2 = [int(max(0, value)) for value in xyxy]
    return np_image[y1:y2, x1:x2]


def ocr_crop(reader: easyocr.Reader, crop: np.ndarray) -> tuple[str, float | None]:
    if crop.size == 0:
        return "", None

    results = reader.readtext(crop, detail=1, paragraph=True)
    if not results:
        return "", None

    text_parts: list[str] = []
    confidences: list[float] = []
    for item in results:
        if len(item) < 3:
            continue
        text_parts.append(str(item[1]).strip())
        confidences.append(float(item[2]))

    text = " ".join(part for part in text_parts if part).strip()
    confidence = (sum(confidences) / len(confidences)) if confidences else None
    return text, confidence


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect PAN/Aadhaar fields with YOLO and OCR each field")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--weights", default="server/ml/models/pan-fields/best.pt", help="YOLO weights path")
    parser.add_argument("--conf", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--json", action="store_true", help="Return JSON output")
    args = parser.parse_args()

    image_path = resolve_image_path(args.image)
    weights_path = resolve_weights_path(args.weights)

    if not image_path:
        print(json.dumps({"text": "", "engine": "none", "error": f"Image file not found: {args.image}"}))
        return

    if not weights_path:
        print(json.dumps({"text": "", "engine": "none", "error": f"Weights not found: {args.weights}"}))
        return

    from ultralytics import YOLO

    model = YOLO(str(weights_path))
    image = Image.open(image_path).convert("RGB")
    np_image = np.array(image)

    reader = easyocr.Reader(["en"], gpu=False)
    results = model.predict(source=np_image, conf=args.conf, verbose=False)

    fields: dict[str, dict[str, float | str | None]] = {}

    if results:
        result = results[0]
        boxes = result.boxes
        names_map = result.names

        for box in boxes:
            cls_id = int(box.cls[0].item())
            cls_name = names_map.get(cls_id, "") if isinstance(names_map, dict) else ""
            key = normalize_key(str(cls_name))
            if not key:
                continue

            xyxy = box.xyxy[0].tolist()
            det_conf = float(box.conf[0].item())
            crop = crop_image(np_image, xyxy)
            text, ocr_conf = ocr_crop(reader, crop)

            if not text:
                continue

            prev = fields.get(key)
            score = det_conf + (ocr_conf or 0.0)
            prev_score = float(prev.get("score", -1.0)) if prev else -1.0

            if score >= prev_score:
                fields[key] = {
                    "text": text,
                    "detConf": det_conf,
                    "ocrConf": ocr_conf,
                    "score": score,
                }

    pan = str(fields.get("panNumber", {}).get("text", "")).strip()
    aadhaar = str(fields.get("aadhaarNumber", {}).get("text", "")).strip()
    name = str(fields.get("name", {}).get("text", "")).strip()
    father = str(fields.get("fatherName", {}).get("text", "")).strip()
    dob = str(fields.get("dob", {}).get("text", "")).strip()
    gender = str(fields.get("gender", {}).get("text", "")).strip()
    address = str(fields.get("address", {}).get("text", "")).strip()

    lines: list[str] = []
    if pan:
        lines.append(f"PAN NUMBER: {pan}")
    if aadhaar:
        lines.append(f"AADHAAR NUMBER: {aadhaar}")
    if name:
        lines.append(f"NAME: {name}")
    if father:
        lines.append(f"FATHER'S NAME: {father}")
    if dob:
        lines.append(f"DOB: {dob}")
    if gender:
        lines.append(f"GENDER: {gender}")
    if address:
        lines.append(f"ADDRESS: {address}")

    avg_conf_parts: list[float] = []
    for item in fields.values():
        maybe = item.get("ocrConf")
        if isinstance(maybe, float):
            avg_conf_parts.append(maybe)
    avg_conf = (sum(avg_conf_parts) / len(avg_conf_parts)) if avg_conf_parts else None

    output = {
        "text": "\n".join(lines),
        "confidence": avg_conf,
        "engine": "yolo11+easyocr",
        "fields": {
            "panNumber": pan or None,
            "aadhaarNumber": aadhaar or None,
            "name": name or None,
            "fatherName": father or None,
            "dob": dob or None,
            "gender": gender or None,
            "address": address or None,
        },
    }

    if args.json:
        print(json.dumps(output))
    else:
        print(output["text"])


if __name__ == "__main__":
    main()
