import time
from io import BytesIO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
import requests
from audit_engine import AtithiDamageEngine

app = FastAPI(title="ATITHI-Net Damage Audit API", version="1.0.0")

# Engine Initialize
engine = AtithiDamageEngine()

class AuditRequest(BaseModel):
    bookingId: str
    checkInUrl: str
    checkOutUrl: str

def fetch_image(url: str) -> Image.Image:
    try:
        res = requests.get(url, timeout=12)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Image download failed with status {res.status_code}")
        return Image.open(BytesIO(res.content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image fetch error: {str(e)}")

@app.get("/")
def health():
    return {"status": "running", "engine": "ATITHI-Net ResNet-50 Siamese"}

@app.post("/api/v1/inspect")
def inspect_room(req: AuditRequest):
    start_time = time.time()

    img_in = fetch_image(req.checkInUrl)
    img_out = fetch_image(req.checkOutUrl)

    # Run AI Change Detection
    result = engine.analyze_pair(img_in, img_out)
    exec_time = round(time.time() - start_time, 2)

    # Attach URLs to damage records
    for d in result["damages"]:
        d["checkInEvidenceUrl"] = req.checkInUrl
        d["checkOutEvidenceUrl"] = req.checkOutUrl

    return {
        "bookingId": req.bookingId,
        "isDamaged": result["isDamaged"],
        "integrityScore": result["integrityScore"],
        "totalFine": result["totalFine"],
        "damages": result["damages"],
        "executionTimeSec": exec_time
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)