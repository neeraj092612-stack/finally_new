"use client";

import dynamic from "next/dynamic";

/** Client-only loader: the static prerender never imports the canvas code. */
const ChartClient = dynamic(() => import("./ChartCanvas"), { ssr: false });

export default ChartClient;
