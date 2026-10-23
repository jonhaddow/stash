<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '#lib/utils.ts';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	// Restyled from shadcn-svelte's to the app's look: square, bold, 48px tall.
	// Pressed, a button shrinks a little and dims, so a tap shows straight away.
	export const buttonVariants = tv({
		base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-[1.5px] border-transparent font-bold whitespace-nowrap no-underline select-none transition-[scale,opacity,background-color] duration-100 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground',
				outline: 'border-foreground bg-background',
				secondary: 'bg-secondary text-secondary-foreground',
				// Remove, sign out: quiet red text, so it doesn't outweigh the actions above it.
				destructive: 'bg-transparent text-destructive active:bg-destructive/10'
			},
			size: {
				default: 'min-h-12 px-[18px] text-[15px]',
				sm: 'min-h-9 px-3.5 text-sm'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		// Unset, like a plain button: a submit button inside a form.
		type,
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
