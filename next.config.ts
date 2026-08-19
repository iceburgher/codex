import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse laddar sin pdfjs-worker med en sökväg som räknas ut vid körning.
   * Buntas paketet in hittar den inte workern, så det lämnas utanför bundlingen
   * och laddas från node_modules på servern.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
