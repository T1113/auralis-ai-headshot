# Ark Seedream Image Provider

This project standardizes image generation on Volcengine Ark Seedream.

## Fixed Defaults

- Base URL: `https://ark.cn-beijing.volces.com/api/v3`
- Endpoint: `/images/generations`
- Model: `doubao-seedream-5-0-260128`
- Size: `2K`
- Response format: `b64_json`
- Watermark: `false`
- Generation mode: image-to-images
- Sequential generation: `auto`
- Max images per job: `5`

## Required Secret

Set one of these Worker secrets:

```bash
wrangler secret put ARK_API_KEY
# or
wrangler secret put DOUBAO_API_KEY
```

No model environment variable is required. The model is intentionally fixed in `src/worker.js` so every caller uses the same quality profile.

## Internal Flow

1. Frontend creates a job through `POST /api/jobs`.
2. Worker creates `job_results` rows immediately.
3. If `ARK_API_KEY` or `DOUBAO_API_KEY` is configured, Worker calls Ark Seedream once with `sequential_image_generation: "auto"`.
4. Returned images are written to R2.
5. `job_results` rows are updated to `ready`.
6. Frontend reads `GET /api/jobs/:jobId` and downloads each result through:

```text
GET /api/jobs/:jobId/results/:resultId/download?variant=jpg
```

If no key is configured, the job stays in `reference_only` mode and clearly tells the user it is showing upload references rather than fake AI output.
