                    ? "contents"
                    : "w-full max-w-3xl mx-4 max-h-[80vh] flex gap-2 relative"
                }>
                    {/* Left Sidebar - Independent glass panel */}
                    <div className={`w-48 flex-shrink-0 flex flex-col py-4 overflow-y-auto rounded-2xl glass-panel-static-solid`}>
                        {!isPageMode && <h2 className="text-lg font-bold text-white px-4 mb-4">{t('profiles.savedProfiles')}</h2>}
                        
                        {/* Profile Navigation - All Profiles */}
                        <nav className="flex-1 space-y-1 px-2 overflow-y-auto">
                            {/* All Profiles - show all of them with current one highlighted */}
                            {(() => {
                                const filtered = profiles.filter(p => p.name && p.name.trim() !== '');
                                return filtered.map((profile) => {
                                // Find the actual index in the original profiles array
                                const actualIndex = profiles.findIndex(p => p.id === profile.id);
                                const isCurrentProfile = actualIndex === currentProfileIndex;
                                const profileAvatar = profileAvatars[profile.uuid ?? ''];
                                // Check if this is a duplicate (folder name differs from display name)
                                const isDuplicate = profile.folderName && profile.folderName !== profile.name;
                                
                                // Panel base colour — used for both active and inactive.
                                // For active: contrasts accent bg → visible clip + gradient.
                                // For inactive: creates a ~11-unit contrast with hover-tinted bg
                                // which is enough to see the clip and the text fade, similar to
                                // how the accent clip looks on the active profile.
                                const btnBg = 'rgba(28,28,30,0.97)';

                                return (
                                    <div
                                        key={profile.id}
                                        className={`w-full flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors group relative overflow-hidden ${
                                            isCurrentProfile
                                                ? ''
                                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                        }`}
                                        style={isCurrentProfile ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
                                    >
                                        <button
                                            onClick={() => !isCurrentProfile && handleSwitchProfile(profile.id)}
                                            className="flex items-center gap-3 w-full min-w-0 overflow-hidden"
                                            disabled={isCurrentProfile}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                                                style={isCurrentProfile
                                                    ? { borderWidth: '2px', borderColor: accentColor, backgroundColor: profileAvatar ? 'transparent' : `${accentColor}20` }
                                                    : { borderWidth: '1px', borderColor: 'rgba(255,255,255,0.2)', backgroundColor: profileAvatar ? 'transparent' : 'rgba(255,255,255,0.05)' }
                                                }
                                            >
                                                {profileAvatar ? (
                                                    <img
                                                        src={profileAvatar}
                                                        className="w-full h-full object-cover object-[center_20%]"
                                                        alt="Avatar"
                                                    />
                                                ) : (
                                                    <User size={14} style={isCurrentProfile ? { color: accentColor } : { color: 'rgba(255,255,255,0.4)' }} />
                                                )}
                                            </div>
                                            <span className={`whitespace-nowrap ${isCurrentProfile ? 'font-medium' : ''}`}>
                                                {profile.name || 'Unnamed'}
                                                {isDuplicate && (
                                                    <span className="text-white/30 text-xs ml-1">({profile.folderName?.replace(profile.name + ' ', '')})</span>
                                                )}
                                            </span>
                                        </button>
                                        {/* Gradient fade — fades to btnBg so there's no colour discontinuity */}
                                        <div
                                            className="absolute inset-y-0 right-0 w-28 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[5]"
                                            style={{ background: `linear-gradient(to right, transparent, ${btnBg})` }}
                                        />
                                        {/* Full-height button container: overflow-hidden on parent clips
                                            hover-highlight shape; btnBg matches hover bg so no dark smear */}
                                        <div
                                            className="absolute right-0 inset-y-0 flex items-center px-1 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            style={{ backgroundColor: btnBg }}
                                        >
                                            <IconButton
                                                size="sm"
                                                onClick={(e) => handleDuplicateProfile(profile.id, e)}
                                                title={t('profiles.duplicateProfile')}
                                            >
                                                <CopyPlus size={14} />
                                            </IconButton>
                                            {!isCurrentProfile && (
                                                <IconButton
                                                    size="sm"
                                                    className="text-red-400/60 hover:text-red-400 hover:bg-red-500/20"
                                                    onClick={(e) => handleDeleteProfile(profile.id, e)}
                                                    title={t('profiles.deleteProfile')}
                                                >
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            )}
                                        </div>
                                    </div>
                                );
                            })})()}
                            
                            {profiles.filter(p => p.name && p.name.trim() !== '').length === 0 && (
