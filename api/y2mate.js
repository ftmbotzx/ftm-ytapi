import Y2MateDownloader from "../../lib/Y2MateDownloader.js";

export default async function handler(req, res) {
  try {
    const input = req.method === "GET" ? req.query : req.body;
    const action = input.action || "download";
    const y2mate = new Y2MateDownloader();

    let result;
    switch (action) {
      case "download":
        if (!input.url) return res.status(400).json({ error: "Missing required field: url" });
        result = await y2mate.download({ url: input.url, quality: input.quality || "360" });
        break;
      case "status":
        if (!input.task_id) return res.status(400).json({ error: "Missing required field: task_id" });
        result = await y2mate.status({ task_id: input.task_id });
        break;
      default:
        return res.status(400).json({ error: `Invalid action: ${action}. Allowed: download | status` });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: `Processing error: ${error.message}` });
  }
}
