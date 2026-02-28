
import { Component, inject, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModeService } from './services/mode.service';
import { JournalLearningService } from './services/journal-learning.service';
import { ModeSwitcherComponent } from './components/mode-switcher.component';
import { MatchingSettingsComponent } from './components/matching-settings.component';
import { MasterSettingsComponent } from './components/master-settings.component';
import { TransactionGridComponent } from './components/transaction-grid.component';
import { ImageViewerComponent } from './components/image-viewer.component';
import { RuleManagerComponent } from './components/rule-manager.component';

import { HostListener } from '@angular/core';
import { HistoryService } from './services/history.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, ModeSwitcherComponent, MatchingSettingsComponent, MasterSettingsComponent, TransactionGridComponent, ImageViewerComponent, RuleManagerComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  modeService = inject(ModeService);
  journalLearning = inject(JournalLearningService);
  historyService = inject(HistoryService);
  activeTab = signal<'guide' | 'main' | 'result' | 'matching' | 'master'>('guide');
  showRuleManager = signal(false);

  // パスワード認証
  isAuthenticated = signal(sessionStorage.getItem('yayoi_auth') === 'ok');
  authCode = signal('');
  authError = signal('');
  authShake = signal(false);

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return hash.toString(36);
  }

  checkAuth() {
    const code = this.authCode().trim();
    if (this.simpleHash(code) === this.simpleHash('aiyayoi2026')) {
      sessionStorage.setItem('yayoi_auth', 'ok');
      this.isAuthenticated.set(true);
      this.authError.set('');
    } else {
      this.authShake.set(true);
      this.authError.set('アクセスコードが正しくありません');
      setTimeout(() => this.authShake.set(false), 500);
    }
  }

  onAuthKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.checkAuth();
  }

  get appLogic() { return this.modeService.activeService(); }
  get cfg() { return this.modeService.modeConfig(); }

  constructor() {
    effect(() => {
      const txs = this.appLogic.processedTransactions();
      const currentTab = untracked(this.activeTab);
      if (txs.length > 0 && currentTab === 'guide') {
        this.activeTab.set('result');
      }
    });
  }

  @HostListener('window:keydown.control.z', ['$event'])
  onUndo(event: KeyboardEvent) {
      if (this.activeTab() === 'result') {
          event.preventDefault();
          this.undo();
      }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.appLogic.setFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        this.appLogic.setFile(file);
        this.activeTab.set('main');
      }
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  isDragging = signal(false);

  triggerFileInput(fileInput: HTMLInputElement) {
    fileInput.click();
  }

  updateTx(index: number, field: string, value: any) {
    this.historyService.push(this.appLogic.processedTransactions());
    this.appLogic.updateTransaction(index, field as any, value);
  }

  deleteTx(index: number) {
    this.historyService.push(this.appLogic.processedTransactions());
    this.appLogic.deleteTransaction(index);
  }

  undo() {
      const prev = this.historyService.undo();
      if (prev) {
          this.appLogic.processedTransactions.set(prev);
          // Also simpler to just replace signal. Does appLogic expose a setter?
          // processedTransactions is a WritableSignal in logic service.
          // appLogic.processedTransactions.set(prev); should work if it's public.
          // Yes it is.
      }
  }

  async runProcess() {
    this.historyService.clear(); // Clear history on new process
    await this.appLogic.processImage();
    if (!this.appLogic.error() && this.appLogic.processedTransactions().length > 0) {
      if (this.appLogic.autoRedirectToEdit()) {
        this.activeTab.set('result');
      }
    }
  }

  onJournalFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.journalLearning.processFile(input.files[0]);
    }
  }
}
