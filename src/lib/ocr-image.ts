export type OcrImageSet = { images: Blob[]; brightness: number; contrast: number };

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("無法處理影像")), "image/png"));

export async function prepareOcrImages(source: Blob): Promise<OcrImageSet> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(3, Math.max(1, 1800 / Math.max(bitmap.width, 1)));
  const width = Math.min(2400, Math.round(bitmap.width * scale));
  const height = Math.min(1800, Math.round(bitmap.height * scale));
  const base = document.createElement("canvas"); base.width = width; base.height = height;
  const context = base.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("瀏覽器無法處理影像");
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const original = await canvasBlob(base);
  const pixels = context.getImageData(0, 0, width, height);
  let total = 0, totalSquared = 0;
  for (let i=0;i<pixels.data.length;i+=4){const gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];total+=gray;totalSquared+=gray*gray;}
  const count = width * height, brightness = total / count, contrast = Math.sqrt(Math.max(0,totalSquared/count-brightness*brightness));
  const enhanced = document.createElement("canvas"); enhanced.width=width; enhanced.height=height;
  const enhancedContext=enhanced.getContext("2d"); if(!enhancedContext)throw new Error("瀏覽器無法強化影像");
  const enhancedPixels=new ImageData(new Uint8ClampedArray(pixels.data),width,height);
  for(let i=0;i<enhancedPixels.data.length;i+=4){const gray=.299*enhancedPixels.data[i]+.587*enhancedPixels.data[i+1]+.114*enhancedPixels.data[i+2];const value=Math.max(0,Math.min(255,(gray-brightness)*1.9+145));enhancedPixels.data[i]=enhancedPixels.data[i+1]=enhancedPixels.data[i+2]=value;}
  enhancedContext.putImageData(enhancedPixels,0,0);
  const threshold=document.createElement("canvas"); threshold.width=width; threshold.height=height;
  const thresholdContext=threshold.getContext("2d"); if(!thresholdContext)throw new Error("瀏覽器無法強化影像");
  const thresholdPixels=new ImageData(new Uint8ClampedArray(enhancedPixels.data),width,height);
  const cutoff=Math.max(105,Math.min(190,brightness*.9));
  for(let i=0;i<thresholdPixels.data.length;i+=4){const value=thresholdPixels.data[i]>cutoff?255:0;thresholdPixels.data[i]=thresholdPixels.data[i+1]=thresholdPixels.data[i+2]=value;}
  thresholdContext.putImageData(thresholdPixels,0,0);
  return { images: [await canvasBlob(enhanced), await canvasBlob(threshold), original], brightness, contrast };
}
