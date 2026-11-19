import {useRef, useState, type KeyboardEvent} from 'react';
import {Headphones, Play} from 'lucide-react';
import './guide.css';

const screens = [
  {id:'setup',label:'훈련 준비',title:'영상 링크로 시작해요.',description:'YouTube 링크를 넣고 연습할 구간을 고릅니다. 공개된 영어 자막이 있으면 스크립트와 시간 정보를 자동으로 준비해요.',detail:'기본은 첫 대사부터 약 40초. 긴 구간은 시간을 늘리거나 두 세션으로 나눌 수 있어요.',alt:'YouTube 링크와 시작·종료 시간을 입력하는 실제 훈련 준비 화면'},
  {id:'repeat',label:'반복 듣기',title:'횟수는 앱에 맡기고, 소리를 들어요.',description:'같은 구간을 10번씩, 세 차례 듣습니다. 실제로 끝까지 재생한 횟수를 세고, 10회가 끝나면 NEXT로 직접 넘어가요.',detail:'PLAY / PAUSE, 반복 사이 간격, +2분 연장으로 자신의 속도에 맞출 수 있어요.',alt:'큰 남은 시간과 7 / 10 반복 횟수, 간격과 재생 버튼이 있는 실제 반복 듣기 화면'},
  {id:'practice',label:'문장별 연습',title:'잘 안 들리는 문장만 다시 들어요.',description:'시간 자막의 문장을 누르면 그 구간이 반복됩니다. 재생 속도를 조절하며 확인하고, 마지막에는 리듬과 강세를 따라 말해요.',detail:'STEP 6은 어려운 부분 듣기, STEP 7은 섀도잉. 두 단계 모두 시간 자막으로 문장별 연습이 가능해요.',alt:'문장마다 타임스탬프와 재생 버튼이 있고 속도를 조절할 수 있는 실제 문장별 연습 화면'},
  {id:'result',label:'훈련 결과',title:'다음 영상의 난이도를 정해요.',description:'훈련이 끝나면 다섯 가지 자기평가에 답합니다. 답변을 바탕으로 LEVEL UP, KEEP LEVEL, LEVEL DOWN 중 하나를 안내해요.',detail:'객관적인 영어 능력 점수가 아닌 다음 자료 선택 가이드예요. 훈련 시간과 실제 반복 횟수도 함께 남습니다.',alt:'훈련 시간, 실제 반복 횟수와 KEEP LEVEL 난이도 가이드가 있는 실제 결과 화면'},
];
const stages = [
  ['First Listening','스크립트를 보기 전에 듣고, 들린 단어나 문장을 메모해요.'],
  ['Transcript Study','스크립트를 읽고 의미를 이해하며, 어려운 표현을 표시해요.'],
  ['Listening × 10','스크립트 없이 소리에 집중해 열 번 들어요.'],
  ['Listening × 10','열 번 더 들어요. 안 들리는 부분은 스크립트를 잠시 확인해요.'],
  ['Listening × 10','다시 스크립트 없이 열 번 들으며 소리를 확인해요.'],
  ['Difficult Parts','잘 안 들리는 문장을 눌러 그 구간만 반복해요.'],
  ['Shadowing','문장별로 들으며 원어민의 리듬과 강세를 따라 말해요.'],
];

export default function Guide(){
  const [selected,setSelected] = useState(1);
  const tabs = useRef<(HTMLButtonElement|null)[]>([]);
  const screen=screens[selected];
  function navigate(event:KeyboardEvent<HTMLButtonElement>,index:number){
    let next=index;
    if(event.key==='ArrowRight') next=(index+1)%screens.length;
    else if(event.key==='ArrowLeft') next=(index+screens.length-1)%screens.length;
    else if(event.key==='Home') next=0;
    else if(event.key==='End') next=screens.length-1;
    else return;
    event.preventDefault();setSelected(next);tabs.current[next]?.focus();
  }
  return <div className="guide-page">
    <header className="guide-header">
      <a className="brand" href="./" aria-label="Listening Lab 앱 열기"><Headphones size={25} strokeWidth={1.7}/>Listening Lab</a>
      <a className="guide-header-link" href="./">앱 열기</a>
    </header>
    <main className="guide-main">
      <section className="guide-intro" aria-labelledby="guide-title">
        <div><h1 id="guide-title">Listening Lab 사용 안내</h1>
          <p>YouTube의 짧은 구간을 7단계로 반복해 듣고,<br className="guide-desktop-break"/> 잘 안 들리는 문장을 따로 연습하는 앱입니다.</p>
        </div>
        <a className="guide-start" href="./"><Play size={16} fill="currentColor" aria-hidden="true"/>훈련 시작하기</a>
      </section>

      <section className="guide-preview" aria-labelledby="preview-title">
        <h2 id="preview-title">화면으로 먼저 살펴보세요.</h2>
        <div className="guide-tabs" role="tablist" aria-label="앱 화면 미리보기">
          {screens.map((item,index)=><button key={item.id} ref={el=>{tabs.current[index]=el;}} type="button" role="tab" id={`tab-${item.id}`} aria-controls="guide-preview-panel" aria-selected={selected===index} tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>navigate(event,index)}>{item.label}</button>)}
        </div>
        <div className="guide-preview-body" role="tabpanel" id="guide-preview-panel" aria-labelledby={`tab-${screen.id}`} tabIndex={0}>
          <div className="guide-preview-copy"><h3>{screen.title}</h3><p>{screen.description}</p><p className="guide-preview-detail">{screen.detail}</p></div>
          <figure className="guide-screen">
            <a href={`./guide/${screen.id}.jpg`} target="_blank" rel="noopener" aria-label={`${screen.label} 화면 크게 보기`}>
              <img src={`./guide/${screen.id}.jpg`} alt={screen.alt} width="1200" height="850" decoding="async"/>
            </a>
            <figcaption><span>실제 앱 화면 · 기록은 설명용 예시입니다.</span><a href={`./guide/${screen.id}.jpg`} target="_blank" rel="noopener">크게 보기</a></figcaption>
          </figure>
        </div>
      </section>

      <section className="guide-flow" aria-labelledby="flow-title">
        <div className="guide-section-heading"><h2 id="flow-title">이 순서로 연습해요.</h2><p>40초 구간 기준 약 1시간. 긴 구간은 더 걸릴 수 있어요.</p></div>
        <ol>{stages.map(([title,description],index)=><li key={index}><span className="guide-step" aria-hidden="true">{index+1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
        <div className="guide-after"><strong>7단계가 끝나면 자기평가</strong><p>내가 느낀 변화와 난이도를 기록하고, 다음 자료를 고를 때 참고해요.</p></div>
      </section>

      <section className="guide-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">시작 전에 알아두세요.</h2>
        <details><summary>무엇을 준비하면 되나요?</summary><p>연습할 YouTube 영상 링크와 조용히 들을 시간을 준비하세요. 처음에는 약 40초의 짧은 구간을 골라보세요. 앱이 첫 대사부터 구간을 제안하고, 시작·종료 시간은 직접 바꿀 수 있어요.</p></details>
        <details><summary>모든 영상의 스크립트를 가져올 수 있나요?</summary><p>공개된 영어 자막이 있는 영상에서 자동 불러오기를 시도합니다. 자막이 없거나 YouTube가 요청을 제한하면 다시 시도하거나, 시간 표시가 있는 스크립트를 붙여넣거나 SRT·VTT 파일을 넣을 수 있어요. 준비된 스크립트는 STEP 2부터 보여줘요.</p></details>
        <details><summary>훈련 기록은 어디에 저장되나요?</summary><p>진행 중인 훈련과 완료 기록은 현재 기기·브라우저에 저장됩니다. Google Sheets를 별도로 연결하면 영상·구간·단계별 시간·자기평가를 시트에도 쌓을 수 있어요. 다음 영상은 난이도 가이드를 참고해 직접 선택하세요.</p></details>
      </section>
    </main>
    <footer className="guide-footer"><span>Listening Lab</span><a href="./">훈련 시작하기</a></footer>
  </div>;
}
