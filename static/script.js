import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let gestureRecognizer;
let runningMode = "VIDEO";
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

let currentLetter = 'A';
let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let alphabetIndex = 0;
let detectionTimer = null;
let lastDetectionTime = 0;
let detectionDuration = 0;
let isSigningName = false;
let signedName = '';

const createGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: runningMode
  });
};

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function enableCam(event) {
  if (!gestureRecognizer) {
    alert("Please wait for gestureRecognizer to load");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    event.target.innerText = "ENABLE WEBCAM";
  } else {
    webcamRunning = true;
    event.target.innerText = "DISABLE WEBCAM";
  }

  const constraints = {
    video: true
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;

  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
  }
  let nowInMs = Date.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    results = gestureRecognizer.recognizeForVideo(video, nowInMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const drawingUtils = new DrawingUtils(canvasCtx);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: "#00FF00",
          lineWidth: 3
        }
      );
      drawingUtils.drawLandmarks(landmarks, {
        color: "#FF0000",
        lineWidth: 1,
        radius: 1
      });
    }
  }
  canvasCtx.restore();

  if (results.gestures.length > 0) {
    gestureOutput.style.display = "block";
    gestureOutput.style.width = videoWidth;
    const gesture = results.gestures[0][0];
    const letter = gesture.categoryName;
    const categoryScore = parseFloat(gesture.score * 100).toFixed(2);

    let handedness = results.handednesses[0][0].displayName;
    handedness = handedness === "Right" ? "Left" : "Right";

    gestureOutput.innerText = `Detected: ${letter}\n Confidence: ${categoryScore}%\n Hand: ${handedness}`;

    const now = Date.now();
    if (lastDetectionTime === 0) {
      lastDetectionTime = now;
    }
    detectionDuration = now - lastDetectionTime;

    if (detectionDuration >= 3000) {
      if (isSigningName) {
        if (letter !== 'NONE' && letter.length === 1) {
          updateSignedName(letter);
        }
        lastDetectionTime = 0;
        detectionDuration = 0;
      } else if (letter === currentLetter) {
        document.getElementById("letter-display").style.color = "green";
        if (!detectionTimer) {
          detectionTimer = setTimeout(() => {
            nextLetter();
            lastDetectionTime = 0;
            detectionDuration = 0;
            detectionTimer = null;
          }, 500);
        }
      }
    }
  } else {
    gestureOutput.style.display = "none";
    lastDetectionTime = 0;
    detectionDuration = 0;
    clearTimeout(detectionTimer);
    detectionTimer = null;
    if (!isSigningName) {
      document.getElementById("letter-display").style.color = "black";
    }
  }

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function updateLetterDisplay() {
  document.getElementById("letter-display").textContent = currentLetter;
  document.getElementById("letter-display").style.color = "black";
  var imageName = currentLetter.toLowerCase() + '.jpg'
  var imagePath = '/static/images/' + imageName;
  var letterImage = document.getElementById("letter-image");
  var letterImageContainer = document.getElementById("letter-image-container");

  var img = new Image();
  img.onload = function() {
    letterImage.src = imagePath;
    letterImage.alt = "ASL letter " + currentLetter;
    letterImage.style.display = "block";
    letterImageContainer.style.backgroundColor = "transparent";
  };
  img.onerror = function() {
    letterImage.style.display = "none";
    letterImageContainer.style.backgroundColor = "#f0f0f0";
  };
  img.src = imagePath;
}

function nextLetter() {
  let previousLetter = currentLetter;
  alphabetIndex++;
  if (alphabetIndex >= alphabet.length) {
    completedAlphabet();
    return;
  }
  currentLetter = alphabet[alphabetIndex];
  updateLetterDisplay();
  sendAutomaticMessage(`User has correctly signed the letter ${previousLetter}. Moving to the next letter: ${currentLetter}`);
}

function completedAlphabet() {
  isSigningName = true;
  document.getElementById("letter-section").style.display = "none";
  document.getElementById("name-signing-section").style.display = "block";
  sendAutomaticMessage("Congratulations! You've completed the alphabet! Now, let's try signing your name. Sign each letter and hold for 1 second to add it to your name.");
}

function updateSignedName(letter) {
  if (letter !== 'NONE' && letter.length === 1) {
    signedName += letter;
    document.getElementById("signed-name").textContent = signedName;
  }
}

function submitSignedName() {
  sendAutomaticMessage(`User has signed their name: ${signedName}`);
  isSigningName = false;
  // Reset for potential future use
  signedName = '';
  document.getElementById("signed-name").textContent = '';
}

function skipLetter() {
  let previousLetter = currentLetter;
  alphabetIndex++;
  if (alphabetIndex >= alphabet.length) {
    completedAlphabet();
    return;
  }
  currentLetter = alphabet[alphabetIndex];
  updateLetterDisplay();
  sendAutomaticMessage(`User has skipped the letter ${previousLetter}. Moving to the next letter: ${currentLetter}`);
}

function startChat() {
  sendAutomaticMessage("Let's start learning sign language!");
}

function sendAutomaticMessage(message) {
  fetch('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      currentLetter: currentLetter,
      signedName: isSigningName ? signedName : null
    }),
  })
  .then(response => response.json())
  .then(data => {
    addMessageToChat(data.response, 'bot');
  })
  .catch((error) => {
    console.error('Error:', error);
  });
}

function sendMessage() {
  const userInput = document.getElementById("user-input");
  const message = userInput.value.trim();
  if (message === "") return;
  addMessageToChat(message, 'user');
  fetch('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      currentLetter: currentLetter,
      signedName: isSigningName ? signedName : null
    }),
  })
  .then(response => response.json())
  .then(data => {
    addMessageToChat(data.response, 'bot');
  })
  .catch((error) => {
    console.error('Error:', error);
  });
  userInput.value = "";
}

function addMessageToChat(message, sender) {
  const chatContainer = document.getElementById("chat-container");
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender + "-message");
  messageElement.textContent = message;
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Attach functions to window object
window.enableCam = enableCam;
window.skipLetter = skipLetter;
window.sendMessage = sendMessage;
window.submitSignedName = submitSignedName;

// Initialize
createGestureRecognizer();
updateLetterDisplay();
startChat();

// Event listeners
document.getElementById("webcamButton").addEventListener("click", enableCam);
document.getElementById("user-input").addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});