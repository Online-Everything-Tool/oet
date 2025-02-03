import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Emojis",
  };

export default function Home() {
    return (<div>
      <input type="file" id="file" accept="image/*" />
      <select>
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
        <option value="webp">WEBP</option>
      </select>
    </div>)
}