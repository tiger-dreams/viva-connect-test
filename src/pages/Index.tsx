import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  // 레거시 페이지는 새로운 Setup 페이지로 리다이렉트
  useEffect(() => {
    navigate('/setup', { replace: true });
  }, [navigate]);

  return null;
};

export default Index;
