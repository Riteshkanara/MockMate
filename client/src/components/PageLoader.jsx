import Loader from './Loader';

const PageLoader = () => (
  <div className="fixed inset-0 w-screen h-screen flex items-center justify-center z-[9999] bg-bg">
    <Loader />
  </div>
);

export default PageLoader;