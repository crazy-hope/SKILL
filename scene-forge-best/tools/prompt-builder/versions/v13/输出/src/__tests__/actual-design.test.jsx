import {actualDesign} from '../../../tests/actual-design-fixture.mjs';
import React from 'react';
import {it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, cleanup, waitFor} from '@testing-library/react';
import {ResultView} from '../components/Results.jsx';
import {emptyBrief} from '../../brief.mjs';
afterEach(cleanup);
const makeResult=()=>({brief:emptyBrief(),spec:{version:'v10',sha256:'test'},schemes:[{name:'石环',zh:'石环中文',en:'Stone ring',design:{题材:'东方奇幻世界',地域:'不限定地域',元素:'悬浮折光石环、镜面水池',视觉偏好:'清晨冷灰',镜头:'俯视远景',风格与复杂度:'写实疏朗',构图:'环形视觉中心'}},{name:'苔原',zh:'苔原中文',en:'Tundra',design:{...actualDesign(),元素:'紫色苔原、晶体树',镜头:'低角度近景'}}]});
it('shows the active design, switches it with English copy, and leaves original auto input collapsed',async ()=>{
 const copy=vi.fn().mockResolvedValue(true);render(<ResultView result={makeResult()} onCopy={copy}/>);
 const summary=screen.getByRole('region',{name:'本方案实际设计'});
 expect(summary).toHaveTextContent('悬浮折光石环、镜面水池');expect(summary).not.toHaveTextContent('自动设计');
 expect(copy).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'方案2：苔原'}));
 expect(summary).toHaveTextContent('紫色苔原、晶体树');expect(summary).not.toHaveTextContent('悬浮折光石环');
 expect(copy).toHaveBeenCalledWith('Tundra');
 fireEvent.click(screen.getByText('本次工作台输入（原始条件）'));
 await waitFor(()=>expect(screen.getByText(/元素：自动设计/)).toBeVisible());
});
it('renders model design markup as text',()=>{
 const r=makeResult();r.schemes[0].design.元素='<img src=x onerror=alert(1)>';
 const {container}=render(<ResultView result={r} onCopy={vi.fn()}/>);
 expect(screen.getByRole('region',{name:'本方案实际设计'})).toHaveTextContent('<img src=x onerror=alert(1)>');
 expect(container.querySelector('img')).toBeNull();
});
