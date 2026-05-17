"use client"

import { GripVertical } from "lucide-react"
import {
  Group,
  Panel,
  Separator as ResizableSeparator,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

type ResizablePanelGroupProps = React.ComponentProps<typeof Group> & {
  direction?: "horizontal" | "vertical"
}

const ResizablePanelGroup = ({
  className,
  direction,
  orientation,
  ...props
}: ResizablePanelGroupProps) => (
  <Group
    orientation={orientation ?? direction}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizableSeparator> & {
  withHandle?: boolean
}) => (
  <ResizableSeparator
    className={cn(
      "relative flex w-2 cursor-col-resize items-center justify-center bg-transparent transition hover:bg-zinc-200/80 active:bg-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:[&>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-7 w-3 items-center justify-center rounded-sm border bg-white shadow-sm aria-[orientation=horizontal]:h-3 aria-[orientation=horizontal]:w-7">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizableSeparator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
