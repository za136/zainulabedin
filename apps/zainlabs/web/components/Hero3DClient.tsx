"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false, loading: () => <div className="hero3d-fallback" /> });

export function Hero3DClient() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return <Hero3D still={still} />;
}
