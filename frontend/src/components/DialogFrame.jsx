import { CloseButton, Dialog, Portal } from '@chakra-ui/react';

// The frame the redesigned pages' dialogs share: a titled sheet with a close button, in
// paper and ink. The content is rendered outside the page, so it carries bw-surface.
export default function DialogFrame({ open, onClose, title, note, width = '520px', children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(event) => !event.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content
            className="bw-surface bw-dialog"
            bg="var(--bw-paper)"
            color="var(--bw-ink)"
            borderRadius="15px"
            maxW={width}
            w="92vw"
            maxH="90vh"
            p={0}
          >
            <header className="bw-dialog__head">
              <div>
                <Dialog.Title asChild>
                  <h2 className="bw-dialog__title">{title}</h2>
                </Dialog.Title>
                {note && <p>{note}</p>}
              </div>
              <Dialog.CloseTrigger asChild position="static">
                <CloseButton size="sm" color="var(--bw-muted)" _hover={{ bg: 'var(--bw-hover)' }} aria-label="Close" />
              </Dialog.CloseTrigger>
            </header>
            <div className="bw-dialog__body">{children}</div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
