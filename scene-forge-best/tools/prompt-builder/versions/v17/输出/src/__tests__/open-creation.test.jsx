import React,{useState} from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {emptyBrief,normalizeBrief,setElementSetting} from '../../brief.mjs';
import {ConditionGrid} from '../components/Conditions.jsx';
afterEach(cleanup);
function Form({related=false}){
 let initial=normalizeBrief({...emptyBrief(),元素:'人物；道路'});
 if(related)initial=setElementSetting(initial,'人物','target','道路');
 const [draft,setDraft]=useState(initial);
 return <><ConditionGrid draft={draft} onChange={setDraft}/><output data-testid="state">{JSON.stringify(draft)}</output></>;
}
const state=()=>JSON.parse(screen.getByTestId('state').textContent);
it('reference default can be explicitly required and demoted',()=>{
 render(<Form/>);
 expect(screen.getByLabelText('大致说明')).toHaveValue('');
 fireEvent.click(screen.getByRole('checkbox',{name:'人物必须出现'}));
 expect(state().elementSettings[0].presence).toBe('required');
 fireEvent.click(screen.getByRole('checkbox',{name:'人物必须出现'}));
 expect(state().elementSettings[0].presence).toBe('reference');
 expect(screen.queryByText('允许补充辅助对象（不自动加人物）')).toBeNull();
});
it('required relationship waits for explicit dependent checkbox and cancel preserves reference',()=>{
 render(<Form related/>);
 fireEvent.click(screen.getByRole('checkbox',{name:'人物必须出现'}));
 expect(state().elementSettings[0].presence).toBe('reference');
 expect(screen.getByRole('button',{name:'保存必需关系'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'取消本次修改'}));
 expect(state().elementSettings[0].presence).toBe('reference');
 fireEvent.click(screen.getByRole('checkbox',{name:'人物必须出现'}));
 fireEvent.click(screen.getByRole('checkbox',{name:'道路也必须出现'}));
 fireEvent.click(screen.getByRole('button',{name:'保存必需关系'}));
 expect(state().elementSettings.map(s=>s.presence)).toEqual(['required','required']);
});
