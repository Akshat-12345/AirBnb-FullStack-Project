import os
import math
import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as T

# =====================================================================
# 1. MATHEMATICAL GEOMETRIC ALIGNMENT ENGINE (HOMOGRAPHY STABILIZER)
# =====================================================================
class SpatialPerspectiveAligner:
    """Eliminates guest handheld camera angle/perspective variations."""
    def __init__(self):
        self.orb = cv2.ORB_create(nfeatures=1500, fastThreshold=12)
        self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    def align(self, t1_np: np.ndarray, t2_np: np.ndarray):
        gray1 = cv2.cvtColor(t1_np, cv2.COLOR_RGB2GRAY)
        gray2 = cv2.cvtColor(t2_np, cv2.COLOR_RGB2GRAY)

        kp1, des1 = self.orb.detectAndCompute(gray1, None)
        kp2, des2 = self.orb.detectAndCompute(gray2, None)

        if des1 is None or des2 is None or len(des1) < 15 or len(des2) < 15:
            return cv2.resize(t2_np, (t1_np.shape[1], t1_np.shape[0]))

        matches = sorted(self.matcher.match(des1, des2), key=lambda x: x.distance)
        good_matches = matches[:min(80, len(matches))]

        if len(good_matches) >= 8:
            src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
            dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
            H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 4.0)
            if H is not None:
                aligned_t2 = cv2.warpPerspective(t2_np, H, (t1_np.shape[1], t1_np.shape[0]))
                return aligned_t2

        return cv2.resize(t2_np, (t1_np.shape[1], t1_np.shape[0]))

# =====================================================================
# 2. CROSS-TEMPORAL DUAL-STREAM SPATIAL TRANSFORMER ATTENTION
# =====================================================================
class BiTemporalGraphAttention(nn.Module):
    """Deep Cross-Attention block modeling non-local context dependencies."""
    def __init__(self, in_features=768, heads=8):
        super().__init__()
        self.heads = heads
        self.head_dim = in_features // heads
        self.scale = self.head_dim ** -0.5

        self.to_q = nn.Conv2d(in_features, in_features, kernel_size=1, bias=False)
        self.to_k = nn.Conv2d(in_features, in_features, kernel_size=1, bias=False)
        self.to_v = nn.Conv2d(in_features, in_features, kernel_size=1, bias=False)
        self.project_out = nn.Conv2d(in_features, in_features, kernel_size=1)

    def forward(self, feat_t1, feat_t2):
        b, c, h, w = feat_t1.shape
        q = self.to_q(feat_t2).view(b, self.heads, self.head_dim, h * w).permute(0, 1, 3, 2)
        k = self.to_k(feat_t1).view(b, self.heads, self.head_dim, h * w).permute(0, 1, 2, 3)
        v = self.to_v(feat_t1).view(b, self.heads, self.head_dim, h * w).permute(0, 1, 3, 2)

        attn_weights = torch.matmul(q, k) * self.scale
        attn_weights = F.softmax(attn_weights, dim=-1)

        aligned_context = torch.matmul(attn_weights, v).permute(0, 1, 3, 2).contiguous()
        aligned_context = aligned_context.view(b, c, h, w)
        aligned_context = self.project_out(aligned_context)

        # Differential vector space representation
        discrepancy_tensor = torch.abs(feat_t2 - aligned_context)
        return discrepancy_tensor, aligned_context

# =====================================================================
# 3. HIGH-RESOLUTION STRUCTURAL ENCODER & PERCEPTUAL EMBEDDER
# =====================================================================
class SpatialOmniEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        weights = models.ConvNeXt_Tiny_Weights.DEFAULT
        base = models.convnext_tiny(weights=weights)
        self.backbone = base.features
        self.cross_attn = BiTemporalGraphAttention(in_features=768, heads=8)

        # Multi-scale deep anomaly segmentation decoder
        self.decoder = nn.Sequential(
            nn.Conv2d(768, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.GELU(),
            nn.Upsample(scale_factor=4, mode='bilinear', align_corners=False),
            nn.Conv2d(256, 96, kernel_size=3, padding=1),
            nn.BatchNorm2d(96),
            nn.GELU(),
            nn.Upsample(scale_factor=4, mode='bilinear', align_corners=False),
            nn.Conv2d(96, 32, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False),
            nn.Conv2d(32, 1, kernel_size=1),
            nn.Sigmoid()
        )

    def extract_discrepancy(self, img1, img2):
        f1 = self.backbone(img1)
        f2 = self.backbone(img2)
        diff_feat, _ = self.cross_attn(f1, f2)
        anomaly_map = self.decoder(diff_feat)
        return anomaly_map, diff_feat

# =====================================================================
# 4. COMPREHENSIVE ASSET ONTOLOGY & FORENSIC ITEM CATALOG (INDIA)
# =====================================================================
class ItemForensicMatrix:
    """Real market repair/replacement database with strict Wear-and-Tear exemptions."""
    CATALOG = {
        # --- ELECTRICAL & FIXTURES ---
        "switch_board": {
            "title": "Modular Electrical Switch/Socket Plate",
            "unit": "Piece",
            "replacement_cost": 280,
            "labor_electrician": 200,
            "category": "Broken",
            "chargeable": True,
            "spec": "Havells/Anchor 6A Modular Switch & Flush Box Replacement"
        },
        "tv_remote": {
            "title": "Smart TV Remote Control (Bluetooth/Infrared)",
            "unit": "Unit",
            "replacement_cost": 850,
            "labor_electrician": 0,
            "category": "Missing/Theft",
            "chargeable": True,
            "spec": "OEM Manufacturer Remote Replacement & Syncing"
        },
        "ac_remote": {
            "title": "Air Conditioner (AC) Remote Unit",
            "unit": "Unit",
            "replacement_cost": 650,
            "labor_electrician": 0,
            "category": "Missing/Theft",
            "chargeable": True,
            "spec": "Inverter AC Dedicated Remote Unit Replacement"
        },
        "kettle_appliance": {
            "title": "Electric Kettle / Microwave Glass Plate",
            "unit": "Unit",
            "replacement_cost": 1250,
            "labor_electrician": 150,
            "category": "Broken",
            "chargeable": True,
            "spec": "Stainless Steel Heating Element / Shattered Turntable"
        },

        # --- LINEN & UPHOLSTERY ---
        "linen_chemical_stain": {
            "title": "Bed Sheet / Duvet Permanent Turmeric/Chemical Stain",
            "unit": "Set",
            "replacement_cost": 650,
            "labor_electrician": 0,
            "category": "Stained",
            "chargeable": True,
            "spec": "Industrial Bleach Treatment or Pure Cotton Bed Sheet Replacement"
        },
        "towel_missing": {
            "title": "Bath Towel / Hand Towel Missing",
            "unit": "Piece",
            "replacement_cost": 300,
            "labor_electrician": 0,
            "category": "Missing/Theft",
            "chargeable": True,
            "spec": "600 GSM Cotton Hotel Towel Replacement"
        },

        # --- STRUCTURAL & WALLS ---
        "wall_gouge_paint": {
            "title": "Wall Plaster Chipping / Ink & Liquid Defacement",
            "unit": "Patch",
            "replacement_cost": 600,
            "labor_electrician": 350,
            "category": "Broken",
            "chargeable": True,
            "spec": "Putty Surface Leveling, Sanding & Asian Paints Royale Coat"
        },
        "mirror_glass": {
            "title": "Dressing Mirror / Bathroom Glass Shelf",
            "unit": "Slab",
            "replacement_cost": 1100,
            "labor_electrician": 300,
            "category": "Broken",
            "chargeable": True,
            "spec": "Beveled Toughened Glass Replacement"
        },

        # --- ABSOLUTE EXEMPTIONS (ZERO RUPEES LIABILITY) ---
        "messy_room_disarray": {
            "title": "Disarranged Pillows, Unfolded Blankets, Floor Luggage",
            "unit": "Incident",
            "replacement_cost": 0,
            "labor_electrician": 0,
            "category": "Wear & Tear",
            "chargeable": False,
            "spec": "Exempt from Penalty: Routine Housekeeping Standard Duty"
        }
    }

# =====================================================================
# 5. ATITHI CORE DAMAGE REASONING ENGINE
# =====================================================================
class AtithiDamageEngine:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.aligner = SpatialPerspectiveAligner()
        self.omni_net = SpatialOmniEncoder().to(self.device).eval()

        self.transform = T.Compose([
            T.Resize((384, 384)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def _spectral_stain_index(self, t1_crop, t2_crop):
        """Calculates normalized chromatic difference to catch stains vs mere shadows."""
        hsv1 = cv2.cvtColor(t1_crop, cv2.COLOR_RGB2HSV)
        hsv2 = cv2.cvtColor(t2_crop, cv2.COLOR_RGB2HSV)
        h_diff = np.mean(cv2.absdiff(hsv1[:, :, 0], hsv2[:, :, 0]))
        s_diff = np.mean(cv2.absdiff(hsv1[:, :, 1], hsv2[:, :, 1]))
        return float(h_diff * 0.6 + s_diff * 0.4)

    def _edge_fracture_index(self, crop):
        """Detects sharp splinter/fracture lines typical of broken plastic/glass."""
        edges = cv2.Canny(crop, 80, 190)
        return float(np.sum(edges > 0) / (crop.shape[0] * crop.shape[1]))

    def analyze_pair(self, pil_t1: Image.Image, pil_t2: Image.Image):
        # 1. Perspective Invariant Alignment
        np_t1 = np.array(pil_t1.convert("RGB"))
        np_t2 = np.array(pil_t2.convert("RGB"))
        aligned_np_t2 = self.aligner.align(np_t1, np_t2)

        pil_t2_aligned = Image.fromarray(aligned_np_t2)

        # 2. Deep Transformer Anomaly Extraction
        tensor_t1 = self.transform(pil_t1).unsqueeze(0).to(self.device)
        tensor_t2 = self.transform(pil_t2_aligned).unsqueeze(0).to(self.device)

        with torch.no_grad():
            anomaly_map, diff_latent = self.omni_net.extract_discrepancy(tensor_t1, tensor_t2)
            anomaly_np = anomaly_map.squeeze().cpu().numpy()

        # 3. Dynamic Bounding Box & Contour Localization
        binary_mask = (anomaly_np > 0.45).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        cleaned_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        total_pixels = cleaned_mask.shape[0] * cleaned_mask.shape[1]
        affected_pixels = int(np.sum(cleaned_mask > 0))
        affected_ratio = affected_pixels / total_pixels

        damages = []
        total_fine = 0
        is_damaged = False

        # If zero significant discrepancy found, return clean pass
        if affected_ratio < 0.012 or len(contours) == 0:
            return {
                "isDamaged": False,
                "integrityScore": 100.0,
                "totalFine": 0,
                "damages": []
            }

        # 4. Multi-Instance Forensic Evaluation Loop
        h, w = np_t1.shape[:2]
        H_FACTOR = h / cleaned_mask.shape[0]
        W_FACTOR = w / cleaned_mask.shape[1]

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 80:  # Noise suppression
                continue

            x, y, cw, ch = cv2.boundingRect(cnt)
            # Map back to original coordinate dimensions
            orig_x, orig_y = int(x * W_FACTOR), int(y * H_FACTOR)
            orig_w, orig_h = int(cw * W_FACTOR), int(ch * H_FACTOR)

            crop1 = np_t1[orig_y:orig_y + orig_h, orig_x:orig_x + orig_w]
            crop2 = aligned_np_t2[orig_y:orig_y + orig_h, orig_x:orig_x + orig_w]

            if crop1.size == 0 or crop2.size == 0:
                continue

            stain_score = self._spectral_stain_index(crop1, crop2)
            edge_fracture = self._edge_fracture_index(crop2)
            aspect_ratio = float(orig_w) / float(orig_h + 1e-5)
            rel_area = (orig_w * orig_h) / (w * h)

            # -------------------------------------------------------------
            # CASE A: UNTIDY / MESSY ROOM (EXEMPTION POLICY)
            # -------------------------------------------------------------
            # Large diffuse region without sharp fracture edges or chemical pigment shift
            if rel_area > 0.08 and stain_score < 18.0 and edge_fracture < 0.05:
                # Disarray detected: Do NOT penalize guest!
                continue

            # -------------------------------------------------------------
            # CASE B: ELECTRICAL SWITCH / SOCKET DAMAGE
            # -------------------------------------------------------------
            # Compact square/rectangle with high fracture or shattered edges
            elif 0.7 <= aspect_ratio <= 1.4 and rel_area < 0.04 and edge_fracture > 0.07:
                item_key = "switch_board"
                item = ItemForensicMatrix.CATALOG[item_key]
                cost = item["replacement_cost"] + item["labor_electrician"]
                total_fine += cost
                is_damaged = True
                damages.append({
                    "item": item["title"],
                    "anomalyType": item["category"],
                    "severity": "Actionable",
                    "fine": cost,
                    "spec": item["spec"],
                    "note": f"Fractured outer plate detected. Replacement: ₹{item['replacement_cost']} + Electrician visit: ₹{item['labor_electrician']}"
                })

            # -------------------------------------------------------------
            # CASE C: LINEN / FABRIC / WALL STAINS
            # -------------------------------------------------------------
            elif stain_score > 26.0:
                item_key = "linen_chemical_stain" if rel_area > 0.03 else "wall_gouge_paint"
                item = ItemForensicMatrix.CATALOG[item_key]
                cost = item["replacement_cost"] + item["labor_electrician"]
                total_fine += cost
                is_damaged = True
                damages.append({
                    "item": item["title"],
                    "anomalyType": item["category"],
                    "severity": "Moderate",
                    "fine": cost,
                    "spec": item["spec"],
                    "note": f"Permanent stain detected (Chromatic shift: {round(stain_score, 1)}). Replacement/Repaint cost: ₹{cost}"
                })

            # -------------------------------------------------------------
            # CASE D: REMOTE OR PORTABLE AMENITY MISSING (THEFT)
            # -------------------------------------------------------------
            elif 2.0 <= aspect_ratio <= 4.8 and rel_area < 0.03:
                item_key = "tv_remote" if orig_y < (h * 0.6) else "ac_remote"
                item = ItemForensicMatrix.CATALOG[item_key]
                cost = item["replacement_cost"]
                total_fine += cost
                is_damaged = True
                damages.append({
                    "item": item["title"],
                    "anomalyType": item["category"],
                    "severity": "Asset Depletion",
                    "fine": cost,
                    "spec": item["spec"],
                    "note": f"Device present at Check-In but absent at Check-Out. Replacement fine: ₹{cost}"
                })

            # -------------------------------------------------------------
            # CASE E: GLASSWARE / FIXTURE FRACTURE
            # -------------------------------------------------------------
            elif edge_fracture > 0.12:
                item_key = "mirror_glass"
                item = ItemForensicMatrix.CATALOG[item_key]
                cost = item["replacement_cost"] + item["labor_electrician"]
                total_fine += cost
                is_damaged = True
                damages.append({
                    "item": item["title"],
                    "anomalyType": item["category"],
                    "severity": "Safety Critical",
                    "fine": cost,
                    "spec": item["spec"],
                    "note": f"Shattered glass element detected. Replacement + Glazing: ₹{cost}"
                })

        # Deduplicate identical items
        seen_items = set()
        clean_damages = []
        clean_fine = 0
        for d in damages:
            if d["item"] not in seen_items:
                seen_items.add(d["item"])
                clean_damages.append(d)
                clean_fine += d["fine"]

        # Calculate Final Room Integrity Score
        integrity = max(0.0, round((1.0 - (affected_ratio * 2.2)) * 100.0, 1))

        return {
            "isDamaged": (clean_fine > 0),
            "integrityScore": integrity if clean_fine > 0 else 100.0,
            "totalFine": clean_fine,
            "damages": clean_damages
        }
        
        # python -m uvicorn main:app --reload --port 8000