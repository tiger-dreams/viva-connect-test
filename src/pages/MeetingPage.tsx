import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MeetingPage = () => {
  const navigate = useNavigate();

  // 레거시 미팅 페이지는 PlanetKit 미팅으로 리다이렉트
  useEffect(() => {
    navigate('/planetkit_meeting', { replace: true });
  }, [navigate]);

  return null;
};

export default MeetingPage;
