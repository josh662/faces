import * as faceapi from 'face-api.js';
import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {

  const [camAccess, setcamAccess] = useState(localStorage.getItem("camAccess") ? localStorage.getItem("camAccess") : false)

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureVideo, setCaptureVideo] = useState(false);

  const videoRef = useRef();
  const videoHeight = 480;
  const videoWidth = 640;
  const canvasRef = useRef();

  var media = []

  function redirect(path) {
    window.open(path, "_self")
  }

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + '/models';

      Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]).then(setModelsLoaded(true));
    }
    loadModels();
    
  }, []);

  const startVideo = () => {
    let cls = ".CamConfirmMessage"
    if (!camAccess) {
      cls = ".CamAccessMessage"
    }
    document.querySelector(cls).classList.add("hidden")
    
    setCaptureVideo(true);
    try {
      navigator.mediaDevices
      .getUserMedia({ video: { width: 300 } })
      .then(stream => { // Caso a pessoa concorde em conceder permissão da câmera
        localStorage.setItem("camAccess", true)
        let video = videoRef.current;
        video.srcObject = stream;
        video.play();
      })
      .catch(err => { // Caso a pessoa clique em não conceder permissão na aba do navegador
        console.error("error:", err);
        alert(err)
        setCaptureVideo(false);
        redirect("/")
      });
    } catch (err) {
      alert("Infelizmente seu dispositivo não suporta o scanner facial :(")
      redirect("/")
    }


  }

  const handleVideoOnPlay = () => {
    setInterval(async () => {
      if (canvasRef && canvasRef.current) {
        canvasRef.current.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
        const displaySize = {
          width: videoWidth,
          height: videoHeight
        }

        faceapi.matchDimensions(canvasRef.current, displaySize);

        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        //console.log(resizedDetections)
        media.push(parseInt(resizedDetections[0]["detection"]["score"]*100))
        let cont = 0
        let sum = 0
        for (let c = 0; c < media.length; c++) {
          cont = c
          sum += media[c]
        }
        let res = sum/cont
        //let txt = ` Probabilidade de ser um rosto: ${parseInt(resizedDetections[0]["detection"]["score"]*100)}\nNúmero de rostos detectados: ${resizedDetections.length}`
        let txt = ` Probabilidade de ser um rosto: ${res}\nNúmero de rostos detectados: ${resizedDetections.length}`
        console.log(txt)

        canvasRef && canvasRef.current && canvasRef.current.getContext('2d').clearRect(0, 0, videoWidth, videoHeight);
        canvasRef && canvasRef.current && faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
        canvasRef && canvasRef.current && faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
        canvasRef && canvasRef.current && faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
      }
    }, 100)
  }

  const closeWebcam = () => {
    videoRef.current.pause();
    videoRef.current.srcObject.getTracks()[0].stop();
    setCaptureVideo(false);
  }

  const CamAccessMessage = () => {
    return (
      <section className="CamAccessMessage">
        <div className="message">
          <h1>Para realizarmos o escaneamento facial, iremos precisar ter acesso à câmera do dispositivo.</h1>
          <h2>Podemos acessá-la?</h2>
          <div className="buttons">
            <button className="access access-allowed" onClick={() => startVideo()}>Sim, vamos prosseguir!</button>
            <button className="access access-denied" onClick={() => redirect("/")}>Não, sair da página</button>
          </div>
        </div>
      </section>
    )
  }

  const CamConfirmMessage = () => {
    return (
      <section className="CamConfirmMessage">
        <div className="message">
            <h1>Podemos começar?</h1>
              <button className="access access-allowed" onClick={() => startVideo()}>Sim, vamos prosseguir!</button>
        </div>
      </section>
    )
  }

  return (
    <div>
      {camAccess ? CamConfirmMessage() : CamAccessMessage()}
      {
        captureVideo ?
          modelsLoaded ?
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                <video ref={videoRef} height={videoHeight} width={videoWidth} onPlay={handleVideoOnPlay} style={{ borderRadius: '10px' }} />
                <canvas ref={canvasRef} style={{ position: 'absolute' }} />
              </div>
            </div>
            :
            <div>Carregando...</div>
          :
          <>
          </>
      }
    </div>
  );
}

export default App;
