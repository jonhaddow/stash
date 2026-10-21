<script lang="ts">
	// Pick a folder, none, or type a new one (which wins if filled in).
	let {
		folders,
		selected = null
	}: {
		folders: { id: number; name: string }[];
		selected?: number | null;
	} = $props();
</script>

<fieldset>
	<legend>Folder</legend>
	<div class="chips">
		<label class="chip"
			><input type="radio" name="folder" value="" checked={selected === null} />None</label
		>
		{#each folders as f (f.id)}
			<label class="chip"
				><input
					type="radio"
					name="folder"
					value={f.id}
					checked={selected === f.id}
				/>{f.name}</label
			>
		{/each}
	</div>
	<input
		class="new"
		name="newFolder"
		placeholder="Or a new folder"
		aria-label="New folder"
		maxlength="40"
		autocomplete="off"
	/>
</fieldset>

<style>
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	legend {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 6px;
		padding: 0;
	}
	.new {
		min-height: 44px;
		padding: 8px 14px;
		border: 1.5px dashed var(--field);
		background: none;
		font-size: 16px;
	}
</style>
