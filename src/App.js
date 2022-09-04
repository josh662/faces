import * as faceapi from 'face-api.js';
import React, { useEffect, useState, useRef } from 'react';
import './App.css';

export default function App() {

  const [camAccess, setcamAccess] = useState(localStorage.getItem("camAccess") ? localStorage.getItem("camAccess") : false)

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureVideo, setCaptureVideo] = useState(false);

  const [msgTip, setMsgTip] = useState("Se posicione na frente da webcam!")

  const videoRef = useRef();
  const videoHeight = 288 //480
  const videoWidth = 384 //640;
  const canvasRef = useRef();

  const PHOTO_NUMBER = 20 // Número de foto a serem tirada para confirmar a identidade
  const MIN_PROB_FACE = 80 // Probabilidade mínima de identificação para considerar como rosto
  var imgs = 1
  var xhr = new XMLHttpRequest();
  var form = new FormData();

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
    let inter = setInterval(async () => {
      if (canvasRef && canvasRef.current) {
        canvasRef.current.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
        const displaySize = {
          width: videoWidth,
          height: videoHeight
        }

        faceapi.matchDimensions(canvasRef.current, displaySize);

        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        if (resizedDetections.length > 0) {
          let prob = parseInt(resizedDetections[0]["detection"]["score"]*100).toFixed(2)
          var res = prob
          let txt = ` Probabilidade de ser um rosto: ${res}\nNúmero de rostos detectados: ${resizedDetections.length}`
          setMsgTip(txt)
  
          //canvasRef && canvasRef.current && canvasRef.current.getContext('2d').clearRect(0, 0, videoWidth, videoHeight);
          //canvasRef && canvasRef.current && faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          //canvasRef && canvasRef.current && faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          //canvasRef && canvasRef.current && faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
          if(resizedDetections.length == 1) {
            if (prob >= MIN_PROB_FACE) {
              var context = canvasRef.current.getContext('2d');
              context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

              let canvas = document.querySelector("canvas")
  
              if (imgs >= PHOTO_NUMBER+1) {
                //form.append("qtd_images", PHOTO_NUMBER);
                for(var pair of form.entries()) {
                  console.log(pair[0]+ ', '+ pair[1]);
                }
                xhr.open('POST', 'http://127.0.0.1:8000/getface', false);
                xhr.onreadystatechange = () => {
                  var identification = JSON.parse(xhr.responseText)
                  console.log(identification)
                  clearInterval(inter)
                  if(identification["faces"] != "") {
                    identify("", identification["faces"])
                  } else {
                    setMsgTip("Nenhum rosto encontrado...")
                  }
                  closeWebcam()
                }
  
                xhr.send(form);
              } else {
                var imgBse64 = canvasRef.current.toDataURL("image/jpeg");
                let image = document.createElement("img")
                image.setAttribute("src", imgBse64)
                var wrapper = document.querySelector('.fotos')
                wrapper.appendChild(image)

                canvas.toBlob(function (blob) {
                  form.append(`img${imgs}`, blob, `img${imgs}.jpg`);
                  imgs += 1
                }, 'image/jpeg');
              }
            }
          } else {
            setMsgTip("Só pode haver uma pessoa na imagem para detecção")
          }

        } else {
          setMsgTip("Não foi detectado ninguém")
        }

      }
    }, 100)
    console.log("Fim do intervalo!")
  }

  function identify(familiar_faces, faces) {
    var form = new FormData();
    form.append("familiar_faces", familiar_faces)
    form.append("faces", faces)

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://127.0.0.1:8000/compare', false);
    xhr.onreadystatechange = () => {
        let nomes = ['Joshua', 'Rasteli', 'Jarbas', 'Leonardo', 'João Bolito', 'Fabrício', 'Marrenta', 'Guidelli']
        let obj = JSON.parse(xhr.responseText)
        let prob = eval(obj["prob"])
        let res = eval(obj["res"])
        let id = Number(obj["index"])
        

        let error = (obj["error"])
        let error_message = obj["error_message"]

        let text = error_message
        if (!error) {
            text = `Você não está cadastrado no banco de dados!`
            if (res[id] > 0.45) {
                text = `Pessoa identificada: ${nomes[id]}\nCerteza: ${(res[id]*100).toFixed(2)}%`
            } else if (res[id] > 0.35) {
                text = `Resultados Inconclusivos. Por favor melhore a imagem para uma melhor identificação`
            }
            //text = `Pessoa identificada: ${nomes[id]}\nCerteza: ${(res[id]*100).toFixed(2)}%`
        }
        setMsgTip(text)
        alert(text)
        console.log(xhr.responseText)
    }
    xhr.send(form);
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
                <video ref={videoRef} height={videoHeight} width={videoWidth} onPlay={handleVideoOnPlay} style={{ borderRadius: '20px' }} />
                <canvas ref={canvasRef} style={{ position: 'absolute', borderRadius: '20px' }} />
              </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                  <p>{msgTip}</p>
                </div>
                <div className="fotos"></div>
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
