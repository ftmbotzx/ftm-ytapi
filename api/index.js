export default function handler(req, res) {
  res.status(200).json({
    message: "Y2Mate API Server on Vercel",
    endpoints: {
      "/api/y2mate": {
        methods: ["GET", "POST"],
        params: ["action=download|status", "url", "quality", "task_id"],
        example: "/api/y2mate?action=download&url=VIDEO_URL&quality=360"
      }
    }
  });
}
