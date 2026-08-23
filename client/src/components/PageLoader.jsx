import React from 'react';
import Loader from './Loader';

const PageLoader = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        background: '#F0F4FF',
      }}
    >
      <Loader />
    </div>
  );
};

export default PageLoader;