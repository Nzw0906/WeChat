export interface TarotCard {
  name: string;
  nameEn: string;
  id: string;
  meaning: string;
  reversedMeaning: string;
  image: string;
}

export const tarotCards: TarotCard[] = [
  { id: "0", name: "愚者", nameEn: "The Fool", meaning: "开端，冒险，纯真", reversedMeaning: "鲁莽，疏忽，愚蠢", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "1", name: "魔术师", nameEn: "The Magician", meaning: "创造力，意志，行动", reversedMeaning: "欺骗，无能，沟通不良", image: "https://images.unsplash.com/photo-1635338164098-4c80336ae55d?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "2", name: "女祭司", nameEn: "The High Priestess", meaning: "直觉，潜意识，智慧", reversedMeaning: "肤浅，秘密，隔阂", image: "https://images.unsplash.com/photo-1635338164801-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "3", name: "皇后", nameEn: "The Empress", meaning: "丰饶，生命，自然", reversedMeaning: "创造力受阻，依赖性", image: "https://images.unsplash.com/photo-1635338164104-585a97576f33?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "4", name: "皇帝", nameEn: "The Emperor", meaning: "权威，结构，控制", reversedMeaning: "专横，僵化，软弱", image: "https://images.unsplash.com/photo-1635338164214-41dccb253303?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "5", name: "教皇", nameEn: "The Hierophant", meaning: "传统，信仰，共识", reversedMeaning: "叛逆，打破常规", image: "https://images.unsplash.com/photo-1635338164319-33810ec5e4bc?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "6", name: "恋人", nameEn: "The Lovers", meaning: "选择，和谐，关系", reversedMeaning: "不和，失衡，错误选择", image: "https://images.unsplash.com/photo-1635338164426-309bd4be66a0?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "7", name: "战车", nameEn: "The Chariot", meaning: "意志力，胜利，决心", reversedMeaning: "失控，缺乏动力", image: "https://images.unsplash.com/photo-1635338164532-680072ec22e4?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "8", name: "力量", nameEn: "Strength", meaning: "勇气，耐心，耐力", reversedMeaning: "自卑，易怒，退缩", image: "https://images.unsplash.com/photo-1635338164639-680072ec22e4?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "9", name: "隐士", nameEn: "The Hermit", meaning: "省思，孤独，指引", reversedMeaning: "疏离，孤僻，急躁", image: "https://images.unsplash.com/photo-1635338164746-680072ec22e4?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "10", name: "命运之轮", nameEn: "Wheel of Fortune", meaning: "变化，命运，循环", reversedMeaning: "坏运，中断，不可预测", image: "https://images.unsplash.com/photo-1635338164853-680072ec22e4?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "11", name: "正义", nameEn: "Justice", meaning: "公平，诚实，责任", reversedMeaning: "不公，偏见，欺骗", image: "https://images.unsplash.com/photo-1635338164959-680072ec22e4?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "12", name: "倒吊人", nameEn: "The Hanged Man", meaning: "牺牲，停顿，新视角", reversedMeaning: "徒劳，停滞，顽固", image: "https://images.unsplash.com/photo-1631553531102-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "13", name: "死神", nameEn: "Death", meaning: "终结，转变，新生", reversedMeaning: "抗拒改变，停滞", image: "https://images.unsplash.com/photo-1631553531209-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "14", name: "节制", nameEn: "Temperance", meaning: "平衡，节制，融合", reversedMeaning: "失衡，极端，冲突", image: "https://images.unsplash.com/photo-1631553531316-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "15", name: "恶魔", nameEn: "The Devil", meaning: "束缚，沉迷，欲望", reversedMeaning: "解脱，清醒，自由", image: "https://images.unsplash.com/photo-1631553531423-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "16", name: "高塔", nameEn: "The Tower", meaning: "剧变，觉醒，灾难", reversedMeaning: "延迟，避免灾难，恐惧", image: "https://images.unsplash.com/photo-1631553531530-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "17", name: "星星", nameEn: "The Star", meaning: "希望，灵感，宁静", reversedMeaning: "失望，悲观，缺乏灵感", image: "https://images.unsplash.com/photo-1631553531637-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "18", name: "月亮", nameEn: "The Moon", meaning: "幻想，恐惧，不安", reversedMeaning: "真相，释放恐惧，清晰", image: "https://images.unsplash.com/photo-1631553531744-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "19", name: "太阳", nameEn: "The Sun", meaning: "成功，快乐，活力", reversedMeaning: "暂时挫折，消沉", image: "https://images.unsplash.com/photo-1631553531851-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "20", name: "审判", nameEn: "Judgement", meaning: "反省，觉醒，重生", reversedMeaning: "自我怀疑，逃避", image: "https://images.unsplash.com/photo-1631553531958-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
  { id: "21", name: "世界", nameEn: "The World", meaning: "圆满，成就，旅行", reversedMeaning: "不完整，阻碍，迟疑", image: "https://images.unsplash.com/photo-1631553532065-6c2438515082?q=80&w=400&h=600&auto=format&fit=crop" },
];
