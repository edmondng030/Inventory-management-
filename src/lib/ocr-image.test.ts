import { describe, expect, it } from "vitest";
import { ocrDimensions } from "./ocr-image";

describe("OCR image sizing", () => {
  it("keeps portrait phone photos proportional and bounded", () => {
    expect(ocrDimensions(3024, 4032)).toEqual({ width: 1350, height: 1800 });
  });
  it("keeps landscape phone photos proportional", () => {
    expect(ocrDimensions(4032, 3024)).toEqual({ width: 1800, height: 1350 });
  });
  it("enlarges small labels without excessive upscaling", () => {
    expect(ocrDimensions(328, 93)).toEqual({ width: 984, height: 279 });
  });
  it("rejects an unready camera frame", () => {
    expect(() => ocrDimensions(0, 0)).toThrow();
  });
});
