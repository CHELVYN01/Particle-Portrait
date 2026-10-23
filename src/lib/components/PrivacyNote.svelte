<aside class="privacy" aria-label="Privacy">
	<span class="lock" aria-hidden="true"></span>
	<p>
		<strong>Your photo never leaves this device.</strong>
		<span class="mono detail">No upload, no server, no account. Everything runs in your browser.</span>
	</p>
</aside>

<style>
	.privacy {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}

	p {
		display: grid;
		gap: 2px;
	}

	strong {
		font-weight: 500;
		font-size: 17px;
	}

	.detail {
		color: var(--muted);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	/* Minimal padlock drawn with hairlines */
	.lock {
		position: relative;
		flex: none;
		width: 12px;
		height: 10px;
		margin-top: 9px;
		border: 1px solid var(--fg);
	}

	.lock::before {
		content: '';
		position: absolute;
		left: 2px;
		right: 2px;
		bottom: 100%;
		height: 5px;
		border: 1px solid var(--fg);
		border-bottom: 0;
	}
</style>
