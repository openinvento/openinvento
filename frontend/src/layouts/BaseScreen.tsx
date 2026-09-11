import type { ReactNode } from "react"

type BaseScreenProps = {
	title: string
	description?: string
	eyebrow?: string
	actions?: ReactNode
	children: ReactNode
}

export default function BaseScreen({
	title,
	description,
	eyebrow,
	actions,
	children,
}: BaseScreenProps) {
	return (
		<section className="mx-auto w-full max-w-6xl">
			<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					{eyebrow && <p className="mb-1 text-sm font-medium text-muted-foreground">{eyebrow}</p>}
					<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
					{description && <p className="mt-2 text-muted-foreground">{description}</p>}
				</div>
				{actions}
			</div>
			{children}
		</section>
	)
}
