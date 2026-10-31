export const actualDesign = () => ({
  题材: '东方奇幻世界', 地域: '不限定地域', 元素: '石环、水池',
  视觉偏好: '清晨冷灰侧光', 镜头: '俯视远景',
  风格与复杂度: '写实疏朗', 构图: '石环位于水池上方'
});

export const selectedBrief = brief => ({...brief,scene:{...brief.scene,selected:{title:'模拟已选画面',summary:'保持本次场景与主体',relationship:'主体与环境形成明确关系',variation:'在相同关系内改变视点'}}});
