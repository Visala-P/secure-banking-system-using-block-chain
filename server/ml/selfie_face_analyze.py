import argparse
import json
from pathlib import Path

import cv2


def detect_faces(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    return faces


def select_largest_deepface_result(analysis):
    if isinstance(analysis, dict):
        return analysis

    if not isinstance(analysis, list) or not analysis:
        return None

    def region_area(item):
        region = item.get('region') if isinstance(item, dict) else None
        if not isinstance(region, dict):
            return 0
        width = int(region.get('w') or 0)
        height = int(region.get('h') or 0)
        return max(width, 0) * max(height, 0)

    return max(analysis, key=region_area)


def estimate_age(image_path, face_crop):
    try:
        from deepface import DeepFace

        # DeepFace is more stable when it runs detection on the full image.
        analysis = DeepFace.analyze(
            img_path=str(image_path),
            actions=['age'],
            detector_backend='opencv',
            enforce_detection=False,
            silent=True
        )

        result = select_largest_deepface_result(analysis)
        age = result.get('age') if isinstance(result, dict) else None

        if isinstance(age, (int, float)):
            return int(age), 'opencv+deepface'

        # Fallback: try directly on the cropped face region.
        crop_analysis = DeepFace.analyze(
            img_path=face_crop,
            actions=['age'],
            detector_backend='opencv',
            enforce_detection=False,
            silent=True
        )

        crop_result = select_largest_deepface_result(crop_analysis)
        crop_age = crop_result.get('age') if isinstance(crop_result, dict) else None
        if isinstance(crop_age, (int, float)):
            return int(crop_age), 'opencv+deepface-crop'

        return None, 'opencv+deepface'
    except Exception as exc:
        return None, f'opencv ({str(exc)[:120]})'


def main():
    parser = argparse.ArgumentParser(description='Analyze selfie image for face count and age estimate')
    parser.add_argument('--image', required=True, help='Path to selfie image')
    parser.add_argument('--json', action='store_true', help='Print JSON output')
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(json.dumps({'success': False, 'faceCount': 0, 'estimatedAge': None, 'engine': 'none', 'error': 'Image file not found'}))
        return

    image = cv2.imread(str(image_path))
    if image is None:
        print(json.dumps({'success': False, 'faceCount': 0, 'estimatedAge': None, 'engine': 'none', 'error': 'Could not read image'}))
        return

    faces = detect_faces(image)
    face_count = int(len(faces))

    estimated_age = None
    engine = 'opencv'

    if face_count >= 1:
        largest = max(faces, key=lambda face: face[2] * face[3])
        x, y, w, h = [int(v) for v in largest]
        face_crop = image[y:y + h, x:x + w]
        estimated_age, engine = estimate_age(image_path, face_crop)

    output = {
        'success': True,
        'faceCount': face_count,
        'estimatedAge': estimated_age,
        'engine': engine
    }

    if args.json:
        print(json.dumps(output))
    else:
        print(output)


if __name__ == '__main__':
    main()
