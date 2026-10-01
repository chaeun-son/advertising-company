export type MusicTrack = {
  id: string;
  category: string;
  title: string;
  src: string;
};

/** 이 앱에서 새로 만든 짧은 배경음악. 기존 음원을 쓰지 않는다. */
export const MUSIC: MusicTrack[] = [
  { id: "calm-a", category: "잔잔", title: "오후 빛", src: "/music/calm-a.mp3" },
  { id: "calm-b", category: "잔잔", title: "고요한 길", src: "/music/calm-b.mp3" },
  { id: "bright-a", category: "밝은", title: "맑은 출발", src: "/music/bright-a.mp3" },
  { id: "bright-b", category: "밝은", title: "환한 창", src: "/music/bright-b.mp3" },
  { id: "emotion-a", category: "감동", title: "따뜻한 기억", src: "/music/emotion-a.mp3" },
  { id: "emotion-b", category: "감동", title: "느린 인사", src: "/music/emotion-b.mp3" },
  { id: "cheerful-a", category: "경쾌", title: "가벼운 발걸음", src: "/music/cheerful-a.mp3" },
  { id: "cheerful-b", category: "경쾌", title: "웃는 하루", src: "/music/cheerful-b.mp3" },
  { id: "grand-a", category: "웅장", title: "큰 자리", src: "/music/grand-a.mp3" },
  { id: "grand-b", category: "웅장", title: "오래 남는 박수", src: "/music/grand-b.mp3" },
  { id: "sport-a", category: "스포츠", title: "뛰기 시작", src: "/music/sport-a.mp3" },
  { id: "sport-b", category: "스포츠", title: "골을 향해", src: "/music/sport-b.mp3" },
];

export const MUSIC_CATEGORIES = [...new Set(MUSIC.map((track) => track.category))];
