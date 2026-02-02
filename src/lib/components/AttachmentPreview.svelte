<script lang="ts">
    import Icon from "@iconify/svelte";

    interface Attachment {
        url: string;
        name: string;
        type: string;
    }

    interface Props {
        attachments: Attachment[];
        onRemove?: (index: number) => void;
        onImageClick?: (attachment: Attachment) => void;
        showRemove?: boolean;
    }

    let { attachments, onRemove, onImageClick, showRemove = false }: Props = $props();

    function getFileIcon(type: string): string {
        if (type.startsWith("image/")) return "lsicon:picture-filled";
        if (type === "application/pdf") return "lsicon:file-pdf-filled";
        if (type === "text/csv") return "lsicon:file-csv-filled";
        if (type.includes("spreadsheet") || type.includes("excel")) return "lsicon:file-xls-filled";
        if (type.includes("word") || type.includes("document")) return "lsicon:file-doc-filled";
        return "lsicon:file-txt-filled";
    }

    function isImage(type: string): boolean {
        return type.startsWith("image/");
    }

    function handleRemove(index: number) {
        if (onRemove) {
            onRemove(index);
        }
    }

    function handleImageClick(attachment: Attachment) {
        if (onImageClick) {
            onImageClick(attachment);
        }
    }
</script>

<div class="flex flex-wrap gap-2">
    {#each attachments as attachment, index}
        <div class="relative group">
            {#if isImage(attachment.type)}
                <button
                    type="button"
                    on:click={() => handleImageClick(attachment)}
                    class="w-16 h-16 rounded-lg overflow-hidden bg-dark-300 cursor-pointer hover:opacity-80 transition border border-dark-100"
                >
                    <img
                        src={`/api/receipts/view/${encodeURIComponent(attachment.url)}`}
                        alt={attachment.name}
                        class="w-full h-full object-cover"
                    />
                </button>
            {:else}
                <a
                    href={`/api/receipts/view/${encodeURIComponent(attachment.url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-dark-300 hover:bg-dark-200 transition border border-dark-100"
                >
                    <Icon icon={getFileIcon(attachment.type)} class="w-7 h-7 text-primary" />
                    <span class="text-[10px] text-gray-400 mt-0.5 font-medium">
                        {attachment.name.split(".").pop()?.toUpperCase()}
                    </span>
                </a>
            {/if}
            {#if showRemove}
                <button
                    type="button"
                    on:click={() => handleRemove(index)}
                    class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                >
                    ✕
                </button>
            {/if}
        </div>
    {/each}
</div>
