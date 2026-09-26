import AccountStep from "../publish/AccountStep.jsx";
import "../interview/interview.css";
import "../publish/publish.css";
import "./start.css";

/**
 * 첫 화면: 무료로 시작하기 = 이메일 가입·로그인(6자리 코드, 비밀번호 없음) → 나이 확인.
 * 만 14세 미만은 보호자 동의를 기다리는 동안에도 먼저 만들어 볼 수 있다(작업은 이 기기에만, 발행·AI 추천은 동의 뒤).
 * @param {{ onChange: (user: any) => void, onContinueMinor: () => void }} props
 */
export default function StartGate({ onChange, onContinueMinor }) {
  return (
    <main className="st">
      <div className="st-card">
        <p className="st-kicker">포트폴리오 메이커 · 베타 무료</p>
        <h1 className="st-title">무료로 시작하기</h1>
        <ul className="st-points">
          <li>몇 가지 질문과 카드 고르기로 내 취향을 찾아요</li>
          <li>취향에 맞춘 세 가지 디자인 방향을 받아요</li>
          <li>내용을 채워 <span className="st-nowrap">내이름.도메인</span> 주소로 공개해요</li>
        </ul>
        <AccountStep
          idPrefix="st"
          onChange={onChange}
          intro="이메일만 있으면 돼요. 처음이면 이대로 가입되고, 비밀번호는 없어요."
        >
          <div className="st-minor">
            <p className="iv-meta iv-left">기다리는 동안 먼저 만들어 볼 수 있어요. 동의 전까지 작업은 이 기기에만 저장되고, 공개와 AI 추천은 동의 뒤에 쓸 수 있어요.</p>
            <button type="button" className="iv-btn iv-btn-primary pb-start" onClick={onContinueMinor}>먼저 만들어 보기</button>
          </div>
        </AccountStep>
      </div>
    </main>
  );
}
