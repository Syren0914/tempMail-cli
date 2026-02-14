import blessed from 'blessed';
import clipboardy from 'clipboardy';
import chalk from 'chalk';
import open from 'open';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listMails, readMail, deleteInbox, downloadAttachment } from './api.js';

export class InboxUI {
  constructor(inbox) {
    this.inbox = inbox;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'TempMail-cli',
      fullUnicode: true
    });

    this.mails = [];
    this.selected = 0;
    this.previewCache = new Map();
    this.currentAttachments = [];

    this.layout();
    this.setupKeys();
    this.setupFlash();
  }

  layout() {
    this.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ` TempMail: {bold}${this.inbox.email}{/bold}   ({yellow-fg}v{/yellow-fg}=view img, {yellow-fg}s{/yellow-fg}=save all, {yellow-fg}q{/yellow-fg}=quit, {yellow-fg}r{/yellow-fg}=refresh, {yellow-fg}d{/yellow-fg}=delete, {yellow-fg}c{/yellow-fg}=copy)`,
      tags: true,
      style: { bg: 'blue', fg: 'white' }
    });

    const listWidth = '45%';
    
    this.inboxList = blessed.list({
        parent: this.screen,
        label: ' Inbox ',
        top: 1,
        left: 0,
        width: listWidth,
        height: '100%-2',
        border: { type: 'line' },
        style: {
          selected: { bg: 'cyan', fg: 'black' },
          label: { fg: 'white' }
        },
        keys: true,
        mouse: true
      });

    this.preview = blessed.box({
      parent: this.screen,
      label: ' Preview ',
      top: 1,
      left: listWidth,
      width: '100%-45%',
      height: '100%-2',
      border: { type: 'line' },
      padding: { left: 1, right: 1 },
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: ' ', style: { bg: 'white' } },
      mouse: true
    });

    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: { fg: 'yellow' }
    });
  }

  setupKeys() {
    this.screen.key(['q', 'C-c', 'escape'], () => this.screen.destroy());

    this.screen.key(['r'], () => this.refresh());
    
    this.screen.key(['c'], () => {
      try {
        clipboardy.writeSync(this.inbox.email);
        this.flash('Address copied to clipboard!');
      } catch (e) {
        this.flash('Copy failed: ' + e.message);
      }
    });

    this.screen.key(['v'], () => this.viewAttachment());
    this.screen.key(['s'], () => this.saveAttachments());

    this.screen.key(['d'], async () => {
        const confirm = blessed.question({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 'shrink',
            height: 'shrink',
            label: ' Confirm ',
            border: 'line',
          });
          
          confirm.ask('Delete this inbox?', async (err, value) => {
            if (value) {
                try {
                    await deleteInbox(this.inbox.inbox_id);
                    this.screen.destroy();
                    process.exit(0);
                } catch (e) {
                    this.flash('Delete failed: ' + e.message);
                }
            }
          });
    });

    this.inboxList.on('select item', (item, index) => {
        this.selected = index;
        this.updatePreview();
    });

    this.inboxList.key(['enter'], () => {
        const mail = this.mails[this.selected];
        if (mail) {
            this.previewCache.delete(mail.id);
            this.updatePreview();
        }
    });
  }

  setupFlash() {
      this.flashTimeout = null;
  }

  flash(msg) {
      this.footer.setContent(' ' + msg);
      this.screen.render();
      if (this.flashTimeout) clearTimeout(this.flashTimeout);
      this.flashTimeout = setTimeout(() => {
          this.footer.setContent('');
          this.screen.render();
      }, 3000);
  }

  async refresh() {
    try {
      this.flash('Fetching mails...');
      const ms = await listMails(this.inbox.inbox_id);
      this.mails = ms;
      
      const items = ms.map((m, i) => {
          const subj = m.subject.substring(0, 30).padEnd(30);
          return `${i+1}. ${subj}  ← ${m.from.substring(0, 20)}`;
      });

      this.inboxList.setItems(items);
      if (items.length > 0) {
          this.inboxList.select(this.selected);
      }
      this.updatePreview();
      this.screen.render();
    } catch (e) {
      this.flash('Error: ' + e.message);
    }
  }

  async updatePreview() {
    const mail = this.mails[this.selected];
    if (!mail) {
        this.preview.setContent('{center}No mails selected{/center}');
        this.screen.render();
        return;
    }

    let cached = this.previewCache.get(mail.id);
    if (!cached) {
        try {
            const full = await readMail(this.inbox.inbox_id, mail.id);
            const body = full.textContent || stripHtml(full.htmlContent) || '(no content)';
            
            this.currentAttachments = full.attachments || [];
            let attachStr = '';
            if (this.currentAttachments.length > 0) {
                attachStr = `\n\n{yellow-fg}{bold}Attachments (${this.currentAttachments.length}):{/bold}{/yellow-fg}\n`;
                this.currentAttachments.forEach((a, i) => {
                    attachStr += `  - ${a.filename || a.name || 'unnamed'} (${formatSize(a.size)})\n`;
                });
                attachStr += `\n{gray-fg}Press 'v' to view first image, 's' to save all{/gray-fg}`;
            }

            cached = `{bold}From:{/bold} ${full.from || mail.from}\n{bold}Subject:{/bold} ${full.subject || mail.subject}\n{bold}Date:{/bold} ${full.received || mail.received}\n{blue-fg}${'-'.repeat(40)}{/blue-fg}\n\n${body}${attachStr}`;
            this.previewCache.set(mail.id, cached);
        } catch (e) {
            cached = '{red-fg}Error loading mail: ' + e.message + '{/red-fg}';
        }
    }

    this.preview.setContent(cached);
    this.screen.render();
  }

  async viewAttachment() {
      if (!this.currentAttachments.length) {
          this.flash('No attachments in this email.');
          return;
      }
      
      const img = this.currentAttachments.find(a => isImage(a.filename || a.name));
      if (!img) {
          this.flash('No image attachments found to view.');
          return;
      }

      try {
          this.flash('Downloading image to view...');
          const mail = this.mails[this.selected];
          const buffer = await downloadAttachment(this.inbox.inbox_id, mail.id, img.id);
          
          const tmpDir = os.tmpdir();
          const fileName = img.filename || img.name || 'temp_image.png';
          const filePath = path.join(tmpDir, `tempmail_${Date.now()}_${fileName}`);
          
          fs.writeFileSync(filePath, Buffer.from(buffer));
          await open(filePath);
          this.flash('Opened image in system viewer.');
      } catch (e) {
          this.flash('View failed: ' + e.message);
      }
  }

  async saveAttachments() {
      if (!this.currentAttachments.length) {
          this.flash('No attachments to save.');
          return;
      }

      try {
          const saveDir = path.join(process.cwd(), 'attachments');
          if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);

          this.flash(`Saving ${this.currentAttachments.length} attachments...`);
          const mail = this.mails[this.selected];

          for (const a of this.currentAttachments) {
              const buffer = await downloadAttachment(this.inbox.inbox_id, mail.id, a.id);
              const fileName = a.filename || a.name || `attachment_${a.id}`;
              const filePath = path.join(saveDir, fileName);
              fs.writeFileSync(filePath, Buffer.from(buffer));
          }

          this.flash(`Saved to ${path.relative(process.cwd(), saveDir)}/`);
      } catch (e) {
          this.flash('Save failed: ' + e.message);
      }
  }

  run() {
    this.refresh();
    setInterval(() => this.refresh(), 5000); // Poll every 5s
    this.screen.render();
  }
}

function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImage(filename) {
    if (!filename) return false;
    const ext = filename.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
}
