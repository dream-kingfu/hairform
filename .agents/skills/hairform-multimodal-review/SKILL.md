---
name: hairform-multimodal-review
description: Review authorized HAIRFORM input portraits and generated hairstyle previews for identity preservation, requested hair changes, non-hair protection, artifacts, and business acceptance. Use when both comparison images are available and a GPT multimodal quality verdict is required.
---

# HAIRFORM Multimodal Review

Compare the original portrait and generated result. Do not infer quality from filenames, scores, prompts, or developer claims alone.

## Preconditions

- Require both images and confirmation that the portrait is owned by or authorized for the user and may be processed for this review.
- Keep review local to the available multimodal surface. Do not upload images to another provider without explicit authorization for that destination.
- If either image is missing, inaccessible, cropped beyond comparison, or too low quality, return `blocked` with the missing evidence. Do not invent a verdict.

## Inspect

Check:

1. Facial identity and geometry are preserved.
2. The requested hairstyle or hair color is visibly achieved.
3. Eyes, eyebrows, nose, mouth, ears, skin, neck, shoulders, clothing, pose, and background are not unintentionally altered.
4. Hairline, forehead, temples, ear edges, nape, parting, fringe, strands, shadows, and texture are coherent.
5. There is no duplicated hair, broken edge, halo, mask seam, plastic texture, impossible volume, lighting conflict, watermark, or unrelated content.
6. The result remains suitable as an honest AI preview rather than being presented as a real post-haircut photo.

## Output

Return JSON only:

```json
{
  "status": "passed",
  "identityPreserved": true,
  "targetHairChangeAchieved": true,
  "nonHairRegionsPreserved": true,
  "faceDistortion": false,
  "backgroundChanged": false,
  "artifactLocations": [],
  "severity": "none",
  "evidence": [],
  "retryInstruction": null,
  "limitations": []
}
```

Use `status: failed` when there is sufficient evidence of a blocking defect, and `status: blocked` when evidence is insufficient. Give a concrete retry instruction tied to visible defects; never return a score without observable evidence.
