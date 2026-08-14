"use client";

import { useState } from "react";

interface LiveProductFrameProps {
  title: string;
  url: string;
}

export function LiveProductFrame({ title, url }: LiveProductFrameProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="live-product-frame">
      {loaded ? (
        <>
          <iframe
            src={url}
            title={`${title} live product`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="frame-toolbar">
            <span>Live product loaded</span>
            <button type="button" onClick={() => setLoaded(false)}>Return to line demo</button>
          </div>
        </>
      ) : (
        <button className="load-live-button" type="button" onClick={() => setLoaded(true)}>
          <span>Load the real product</span>
          <small>Starts only when requested</small>
        </button>
      )}
    </div>
  );
}
