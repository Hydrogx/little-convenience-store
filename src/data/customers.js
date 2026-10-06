/**
 * 顾客角色数据。
 * 全部是原创的卡通角色，不使用任何真实品牌或真人形象。
 */
export const CUSTOMERS = [
  { id: 'mimi', name: { zh: '米米', en: 'Mimi' }, emoji: '👧', hair: '#ffd93d', skin: '#ffd9b3' },
  { id: 'lele', name: { zh: '乐乐', en: 'Lele' }, emoji: '👦', hair: '#8b5e3c', skin: '#f6c99a' },
  { id: 'nainai', name: { zh: '奶奶', en: 'Grandma' }, emoji: '👵', hair: '#dfe6ef', skin: '#ffdcb8' },
  { id: 'shushu', name: { zh: '叔叔', en: 'Uncle' }, emoji: '🧑', hair: '#3b4252', skin: '#e8b48a' },
  { id: 'tutu', name: { zh: '兔兔', en: 'Bunny' }, emoji: '🐰', hair: '#ffffff', skin: '#ffe9ef' },
  { id: 'xiaomao', name: { zh: '小猫', en: 'Kitten' }, emoji: '🐱', hair: '#ffb26b', skin: '#ffe3c2' },
  { id: 'xiaogou', name: { zh: '小狗', en: 'Puppy' }, emoji: '🐶', hair: '#c98d5a', skin: '#f7dcb9' },
  { id: 'penguin', name: { zh: '企鹅', en: 'Penguin' }, emoji: '🐧', hair: '#2f3640', skin: '#eef3f8' }
];

const BY_ID = new Map(CUSTOMERS.map((customer) => [customer.id, customer]));

export function getCustomer(id) {
  return BY_ID.get(id) || null;
}

export function customerName(id, language) {
  const customer = getCustomer(id);
  if (!customer) return id;
  return language === 'en' ? customer.name.en : customer.name.zh;
}
