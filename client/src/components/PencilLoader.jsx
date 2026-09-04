import React from 'react';

const PencilLoader = () => {
  return (
    <>
      <style>{`
        .mm-skeleton {
          position: relative;
          width: 240px;
          height: 130px;
          border: 1px solid #d3d3d3;
          padding: 15px;
          background-color: #e3e3e3;
          overflow: hidden;
          border-radius: 12px;
        }
        .mm-skeleton::after {
          content: "";
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          background: linear-gradient(
            110deg,
            rgba(227,227,227,0) 0%,
            rgba(227,227,227,0) 40%,
            rgba(227,227,227,0.8) 50%,
            rgba(227,227,227,0) 60%,
            rgba(227,227,227,0) 100%
          );
          animation: mm-shimmer 1.2s linear infinite;
        }
        .mm-skeleton-inner {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .mm-skeleton-inner > div {
          background-color: #cacaca;
          border-radius: 4px;
        }
        .mm-skeleton-circle {
          width: 50px;
          height: 50px;
          border-radius: 50% !important;
        }
        .mm-skeleton-line1 {
          position: absolute;
          top: 11px;
          left: 58px;
          height: 10px;
          width: 100px;
        }
        .mm-skeleton-line2 {
          position: absolute;
          top: 34px;
          left: 58px;
          height: 10px;
          width: 150px;
        }
        .mm-skeleton-line3 {
          position: absolute;
          top: 57px;
          left: 0;
          height: 10px;
          width: 100%;
        }
        .mm-skeleton-line4 {
          position: absolute;
          top: 80px;
          left: 0;
          height: 10px;
          width: 92%;
        }
        @keyframes mm-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="mm-skeleton">
        <div className="mm-skeleton-inner">
          <div className="mm-skeleton-circle" />
          <div className="mm-skeleton-line1" />
          <div className="mm-skeleton-line2" />
          <div className="mm-skeleton-line3" />
          <div className="mm-skeleton-line4" />
        </div>
      </div>
    </>
  );
};

export default PencilLoader;