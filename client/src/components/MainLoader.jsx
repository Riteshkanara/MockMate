import styled from 'styled-components';

const MainLoader = () => (
  <StyledWrapper>
    <div className="loader" />
  </StyledWrapper>
);

const StyledWrapper = styled.div`
  .loader {
    display: block;
    --height-of-loader: 4px;
    --loader-color: #1A6EFF;
    width: 130px;
    height: var(--height-of-loader);
    border-radius: 30px;
    background-color: rgba(26,110,255,0.15);
    position: relative;
  }
  .loader::before {
    content: "";
    position: absolute;
    background: var(--loader-color);
    top: 0; left: 0;
    width: 0%; height: 100%;
    border-radius: 30px;
    animation: moving 1s ease-in-out infinite;
  }
  @keyframes moving {
    50%  { width: 100%; }
    100% { width: 0; right: 0; left: unset; }
  }
`;

export default MainLoader;