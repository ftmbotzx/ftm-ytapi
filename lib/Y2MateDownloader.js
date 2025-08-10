import axios from "axios";
import Encoder from "./encoder.js";  // Adjust this import path if needed

export default class Y2MateDownloader {
  constructor(domain = "random") {
    this.domains = ["https://content-cdn.y2mate.app", "https://bzhve.y2mate.app"];
    this.baseUrl = this.resolveBaseUrl(domain);
    this.commonHeaders = {
      accept: "*/*",
      "accept-language": "id-ID,id;q=0.9",
      "cache-control": "no-cache",
      origin: this.baseUrl,
      pragma: "no-cache",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
    };
  }

  enc(data) {
    const { uuid: jsonUuid } = Encoder.enc({ data: data, method: "combined" });
    return jsonUuid;
  }

  dec(uuid) {
    const decryptedJson = Encoder.dec({ uuid: uuid, method: "combined" });
    return decryptedJson.text;
  }

  resolveBaseUrl(domain) {
    if (domain === "random") {
      const random = this.domains[Math.floor(Math.random() * this.domains.length)];
      console.log("[ftmdeveloperz] Random CDN Selected:", random);
      return random;
    }
    if (this.domains.includes(domain)) return domain;
    return this.domains[0];
  }

  async download({ url, quality = "480" }) {
    try {
      const analyzeUrl = `${this.baseUrl}/mates/analyzeV2/ajax`;
      const analyzeData = new URLSearchParams({
        k_query: url,
        k_page: "home",
        hl: "en",
        q_auto: "0"
      }).toString();
      const analyzeResponse = await axios.post(analyzeUrl, analyzeData, {
        headers: { ...this.commonHeaders, referer: `${this.baseUrl}/en102` }
      });
      const analyzeResult = analyzeResponse.data;
      if (analyzeResult.status !== "ok") throw new Error(analyzeResult.mess || "Gagal analisis");
      const videoId = analyzeResult.vid;
      let b_id = null;
      if (analyzeResult.links?.mp4?.[quality]) {
        b_id = analyzeResult.links.mp4[quality].k;
      } else if (analyzeResult.links?.mp3?.[quality]) {
        b_id = analyzeResult.links.mp3[quality].k;
      }
      if (!b_id) {
        const available = {
          video: Object.keys(analyzeResult.links?.mp4 || {}),
          audio: Object.keys(analyzeResult.links?.mp3 || {})
        };
        throw new Error(`Quality '${quality}' tidak tersedia. Format tersedia: ${JSON.stringify(available)}`);
      }
      const convertUrl = `${this.baseUrl}/mates/convertV2/pool`;
      const convertData = new URLSearchParams({
        vid: videoId,
        b_id: b_id
      }).toString();
      const convertResponse = await axios.post(convertUrl, convertData, {
        headers: { ...this.commonHeaders, referer: `${this.baseUrl}/youtube/${videoId}` }
      });
      const convertResult = convertResponse.data;
      if (convertResult.status !== "ok") throw new Error(convertResult.mess || "Gagal konversi");
      if (convertResult.dlink) {
        return {
          status: true,
          title: analyzeResult.title || "Unknown",
          quality: quality,
          size: convertResult.fsize || "Unknown",
          download_url: convertResult.dlink,
          vid: videoId
        };
      }
      const text = { ...analyzeResult, ...convertResult, vid: videoId, b_id: b_id };
      const task_id = this.enc(text);
      return {
        status: true,
        task_id: task_id,
        message: "Processing... use status endpoint to check progress"
      };
    } catch (err) {
      console.error("[Y2Mate][Download] Error:", err.message);
      return { status: false, message: err.message };
    }
  }

  async status({ task_id }) {
    try {
      const json = this.dec(task_id);
      if (!json) throw new Error("Gagal decrypt task_id (hasil kosong)");
      const parsed = json;
      const { vid: videoId, b_id } = parsed;
      if (!b_id || !videoId) throw new Error("Isi task_id tidak valid");
      const statusUrl = `${this.baseUrl}/mates/convertV2/pool`;
      const statusData = new URLSearchParams({
        vid: videoId,
        b_id: b_id
      }).toString();
      const statusResponse = await axios.post(statusUrl, statusData, {
        headers: { ...this.commonHeaders, referer: `${this.baseUrl}/youtube/${videoId}` }
      });
      const statusResult = statusResponse.data;
      if (statusResult.status !== "ok") throw new Error(statusResult.mess || "Status gagal");
      if (statusResult.dlink) {
        return {
          status: true,
          title: parsed.title || "Unknown",
          quality: parsed.quality || "Unknown",
          size: statusResult.fsize || "Unknown",
          download_url: statusResult.dlink,
          vid: videoId
        };
      }
      return { status: true, ...parsed, ...statusResult };
    } catch (err) {
      console.error("[Y2Mate][Status] Error:", err.message);
      return { status: false, message: err.message };
    }
  }
  }
