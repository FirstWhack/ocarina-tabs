import { AppHeader } from './features/app/AppHeader'
import { ComposerControlsPanel } from './features/app/ComposerControlsPanel'
import { ImportControlsPanel } from './features/app/ImportControlsPanel'
import { NotePreviewPanel } from './features/app/NotePreviewPanel'
import { useOcarinaTabApp } from './features/app/useOcarinaTabApp'
import { GeneratedTabPanel } from './features/tabViewer/GeneratedTabPanel'
import './App.css'

function App() {
  const app = useOcarinaTabApp()

  return (
    <main className="app-shell">
      <section className="app-workspace" aria-labelledby="page-title">
        <AppHeader
          appMode={app.appMode}
          onModeChange={app.actions.handleModeChange}
        />

        <section className="midi-page" aria-label="MIDI tab builder">
          <NotePreviewPanel
            activeFingering={app.activeFingering}
            activeMidiNote={app.activeMidiNote}
            activeTabDocument={app.activeTabDocument}
            compactMode={app.appMode === 'composer'}
            defaultCollapsed={app.appMode === 'composer'}
            auditionNotes={app.auditionNotes}
            onAuditionToggle={app.actions.handleAuditionToggle}
            onKeyboardKeyDown={app.actions.handleKeyboardKeyDown}
            onKeyboardKeyUp={app.actions.handleKeyboardKeyUp}
            onKeyboardNoteSelect={app.actions.handleKeyboardNoteSelect}
            onKeyboardPointerCancel={app.actions.handleKeyboardPointerCancel}
            onKeyboardPointerDown={app.actions.handleKeyboardPointerDown}
            onKeyboardPointerLeave={app.actions.handleKeyboardPointerLeave}
            onKeyboardPointerUp={app.actions.handleKeyboardPointerUp}
            onPreviewSample={app.actions.handlePreviewSample}
            playableDurationMs={app.playableDurationMs}
            playableRange={app.playableRange}
            playback={app.playback}
            profile={app.profile}
          />

          <div className="midi-page__side">
            {app.appMode === 'import' ? (
              <ImportControlsPanel
                activeTabDocument={app.activeTabDocument}
                exportLinkRef={app.refs.exportLinkRef}
                importedTabDocument={app.importState.importedTabDocument}
                isImportedTabActive={app.importState.isImportedTabActive}
                midiError={app.importState.midiError}
                midiFileName={app.importState.midiFileName}
                onClearTracks={app.actions.handleClearTracks}
                onExportTab={app.actions.handleExportTab}
                onLoadSample={app.actions.handleLoadSample}
                onMidiUpload={app.actions.handleMidiUpload}
                onSelectAllTracks={app.actions.handleSelectAllTracks}
                onSuggestionDifficultyChange={
                  app.actions.setSuggestionDifficulty
                }
                onTabImport={app.actions.handleTabImport}
                onTrackSelectionChange={app.actions.handleTrackSelectionChange}
                onTranspose={app.actions.handleTranspose}
                onTranspositionInputChange={
                  app.actions.handleTranspositionInputChange
                }
                onUseSuggestedTrack={app.actions.handleUseSuggestedTrack}
                onUseSuggestedTransposition={
                  app.actions.handleUseSuggestedTransposition
                }
                parsedMidi={app.importState.parsedMidi}
                selectedTracks={app.importState.selectedTracks}
                suggestionDifficulty={app.importState.suggestionDifficulty}
                suggestedTracks={app.importState.suggestedTracks}
                suggestedTransposition={app.importState.suggestedTransposition}
                tabFileMessage={app.importState.tabFileMessage}
                transpositionSemitones={
                  app.importState.transpositionSemitones
                }
              />
            ) : (
              <ComposerControlsPanel
                activeMidiNote={app.composerState.activeMidiNote}
                composerState={app.composerState.composerState}
                composerTabDocument={app.composerState.composerTabDocument}
                composerTextInput={app.composerState.composerTextInput}
                composerTranspositionSemitones={
                  app.composerState.composerTranspositionSemitones
                }
                dispatchComposer={app.actions.dispatchComposer}
                exportLinkRef={app.refs.exportLinkRef}
                isComposerRecording={app.composerState.isComposerRecording}
                onComposerChangeSelectedDuration={
                  app.actions.handleComposerChangeSelectedDuration
                }
                onComposerChangeSelectedNote={
                  app.actions.handleComposerChangeSelectedNote
                }
                onComposerClear={app.actions.handleComposerClear}
                onComposerDeleteSelected={
                  app.actions.handleComposerDeleteSelected
                }
                onComposerInsert={app.actions.handleComposerInsert}
                onComposerRecordingToggle={
                  app.actions.handleComposerRecordingToggle
                }
                onComposerSelectedNoteChange={
                  app.actions.handleComposerSelectedNoteChange
                }
                onComposerTextSubmit={app.actions.handleComposerTextSubmit}
                onExportTab={app.actions.handleExportTab}
                onTranspose={app.actions.handleTranspose}
                onTranspositionInputChange={
                  app.actions.handleTranspositionInputChange
                }
                onUseSuggestedTransposition={
                  app.actions.handleUseSuggestedTransposition
                }
                playback={app.playback}
                playableDurationMs={app.playableDurationMs}
                profile={app.profile}
                setComposerTextInput={app.actions.setComposerTextInput}
                suggestedComposerTransposition={
                  app.composerState.suggestedComposerTransposition
                }
              />
            )}
          </div>

          <GeneratedTabPanel
            activeStep={app.activeTabStep}
            displayMode={app.tabViewState.tabDisplayMode}
            hideUnsupportedNotes={app.tabViewState.hideUnsupportedNotes}
            midiRangeFit={app.activeMidiRangeFit}
            monophonicLine={app.activeMonophonicLine}
            onDisplayModeChange={app.actions.setTabDisplayMode}
            onHideUnsupportedNotesChange={app.actions.setHideUnsupportedNotes}
            onStepSelect={app.actions.handleStepSelect}
            tabDocument={app.activeTabDocument}
            tabLines={app.tabLines}
            tabSections={app.tabSections}
          />
        </section>
      </section>
    </main>
  )
}

export default App
