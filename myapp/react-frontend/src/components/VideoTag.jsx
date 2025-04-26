import { useEffect, useRef } from "react";

function VideoTag({ srcObject, style, className, ...props }) {
  const videoRef = useRef();

  useEffect(() => {
    if (srcObject && videoRef.current) {
      videoRef.current.srcObject = srcObject;
    }
  }, [srcObject]);

  return (
    <video
      ref={videoRef}
      style={style}
      className={`video-element ${className || ''}`}
      autoPlay
      playsInline
      onCanPlay={() => videoRef.current.play()}
      {...props}
    />
  );
}

export default VideoTag;