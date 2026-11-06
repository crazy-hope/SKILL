import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { OptionHelp } from "../../../shared/option-help";
export function InfoTooltip({
  children,
  content,
}: {
  children: React.ReactElement;
  content: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="option-tooltip"
            side="right"
            sideOffset={10}
            collisionPadding={14}
            avoidCollisions
          >
            {content}
            <TooltipPrimitive.Arrow className="option-tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function HelpContent({
  title,
  help,
}: {
  title: string;
  help: OptionHelp;
}) {
  return (
    <>
      <strong className="option-tooltip-title">{title}</strong>
      <p>{help.meaning}</p>
      <div className="option-tooltip-example">
        <span>提示词表达示例</span>
        <p>{help.example}</p>
      </div>
      {help.note && <p className="option-tooltip-note">{help.note}</p>}
    </>
  );
}
export function OptionTooltip({
  title,
  help,
  children,
}: {
  title: string;
  help: OptionHelp;
  children: React.ReactElement;
}) {
  return (
    <InfoTooltip
      content={
        <>
          <HelpContent title={title} help={help} />
          <small className="option-tooltip-disclaimer">
            示例说明表达方向，最终措辞会随场景调整。
          </small>
        </>
      }
    >
      {children}
    </InfoTooltip>
  );
}
