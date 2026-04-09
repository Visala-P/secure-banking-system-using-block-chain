import argparse
import json
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
HOME_RUNS_ROOT = Path.home() / 'runs'


def resolve_existing_path(raw_path: str, search_roots: list[Path]) -> Path | None:
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

    basename = Path(raw_path).name
    for root in search_roots:
        fallback = root / basename
        if fallback.exists():
            return fallback

    return None


def resolve_model_dir(raw_path: str) -> Path | None:
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
        HOME_RUNS_ROOT,
        HOME_RUNS_ROOT / 'detect'
    ]

    resolved = resolve_existing_path(raw_path, search_roots)
    if resolved:
        return resolved

    return None


def run_trocr(image_path: Path, model_dir: Path | None):
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    import torch

    model_ref = str(model_dir) if model_dir and model_dir.exists() else "microsoft/trocr-small-printed"
    processor = TrOCRProcessor.from_pretrained(model_ref)
    model = VisionEncoderDecoderModel.from_pretrained(model_ref)
    model.eval()

    image = Image.open(image_path).convert("RGB")
    pixel_values = processor(images=image, return_tensors="pt").pixel_values

    with torch.no_grad():
        generated_ids = model.generate(pixel_values)

    text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
    return text, None, "trocr"


def run_easyocr(image_path: Path):
    import easyocr

    reader = easyocr.Reader(["en"], gpu=False)
    results = reader.readtext(str(image_path), detail=1, paragraph=True)

    if not results:
        return "", None, "easyocr"

    text_chunks = []
    confidences = []

    for item in results:
        if len(item) < 3:
            continue
        text_chunks.append(item[1])
        confidences.append(float(item[2]))

    text = "\n".join(chunk for chunk in text_chunks if chunk).strip()
    confidence = (sum(confidences) / len(confidences)) if confidences else None
    return text, confidence, "easyocr"


def infer(image_path: Path, model_dir: Path | None):
    errors = []

    try:
        return run_trocr(image_path, model_dir)
    except Exception as exc:
        errors.append(f"trocr: {exc}")

    try:
        return run_easyocr(image_path)
    except Exception as exc:
        errors.append(f"easyocr: {exc}")

    return "", None, "none", "; ".join(errors)


def main():
    parser = argparse.ArgumentParser(description="PAN OCR inference")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--model-dir", default="server/ml/models/pan-ocr", help="Fine-tuned model directory")
    parser.add_argument("--json", action="store_true", help="Print JSON output")
    args = parser.parse_args()

    image_path = resolve_image_path(args.image)
    model_dir = resolve_model_dir(args.model_dir)

    if not image_path:
        output = {"text": "", "confidence": None, "engine": "none", "error": f"Image file not found: {args.image}"}
        print(json.dumps(output))
        return

    result = infer(image_path, model_dir)

    if len(result) == 4:
        text, confidence, engine, error = result
        output = {"text": text, "confidence": confidence, "engine": engine, "error": error}
    else:
        text, confidence, engine = result
        output = {"text": text, "confidence": confidence, "engine": engine}

    if args.json:
        print(json.dumps(output))
    else:
        print(output["text"])


if __name__ == "__main__":
    main()
