"use client";

export interface ChartCanvasProps {
  ticker: string;
  dimmed: boolean;
}

// RED stub: renders nothing useful, behavior arrives in the GREEN commit.
export default function ChartCanvas({ ticker, dimmed }: ChartCanvasProps) {
  void ticker;
  void dimmed;
  return <div />;
}
