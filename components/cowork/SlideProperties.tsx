import { SlideElement, Slide } from './types';
import { cn } from "@/lib/utils";
import { 
  AlignLeft, AlignCenter, AlignRight, 
  Bold, Italic, Underline, 
  Type, Square, Image as ImageIcon, 
  Move, Maximize
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface SlidePropertiesProps {
  selection: string[];
  elements: SlideElement[];
  currentSlide?: Slide;
  onUpdate: (id: string, updates: Partial<SlideElement>) => void;
  onLayerAction: (action: 'front' | 'back') => void;
  onSlideUpdate?: (updates: Partial<Slide>) => void;
}

export default function SlideProperties({ selection, elements, currentSlide, onUpdate, onLayerAction, onSlideUpdate }: SlidePropertiesProps) {
  if (selection.length === 0) {
    return (
      <aside className="w-80 bg-white border-l h-full overflow-y-auto custom-scroll">
         <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
               Slide Settings
            </h3>
         </div>
         <div className="p-4 space-y-6">
             <section className="space-y-4">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Background</label>
               <div className="grid grid-cols-2 gap-2">
                   <button 
                      onClick={() => onSlideUpdate?.({ background: { type: 'solid', value: '#ffffff' } })}
                      className="h-20 rounded border hover:ring-2 hover:ring-indigo-500 bg-white flex items-center justify-center text-xs text-slate-400"
                   >
                     White
                   </button>
                   <button 
                      onClick={() => onSlideUpdate?.({ background: { type: 'solid', value: '#000000' } })}
                      className="h-20 rounded border hover:ring-2 hover:ring-indigo-500 bg-slate-950 flex items-center justify-center text-xs text-white"
                   >
                     Black
                   </button>
                   <button 
                      onClick={() => onSlideUpdate?.({ background: { type: 'gradient', value: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)' } })}
                      className="h-20 rounded border hover:ring-2 hover:ring-indigo-500 flex items-center justify-center text-xs text-slate-600"
                      style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)' }}
                   >
                     Soft
                   </button>
                   <button 
                      onClick={() => onSlideUpdate?.({ background: { type: 'gradient', value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' } })}
                      className="h-20 rounded border hover:ring-2 hover:ring-indigo-500 flex items-center justify-center text-xs text-white"
                      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}
                   >
                     Deep
                   </button>
               </div>
               
               <div className="space-y-2 pt-2">
                 <span className="text-sm text-slate-600">Unsplash Search</span>
                 <div className="flex gap-2">
                    <input 
                      placeholder="Search photos..." 
                      className="flex-1 p-2 border rounded-md text-xs"
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              // Mock search for now or use source.unsplash.com with keywords
                              // Since source.unsplash is deprecated, we use specific high-quality IDs for demo
                              const keyword = e.currentTarget.value;
                              onSlideUpdate?.({ background: { type: 'image', value: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&q=80` } }); 
                          }
                      }}
                    />
                 </div>
                 <div className="grid grid-cols-3 gap-1 pt-1">
                     {[
                         'https://images.unsplash.com/photo-1557683316-973673baf926',
                         'https://images.unsplash.com/photo-1550684848-fac1c5b4e853',
                         'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
                         'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1',
                         'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
                         'https://images.unsplash.com/photo-1497366216548-37526070297c'
                     ].map((url, i) => (
                         <button 
                            key={i}
                            className="aspect-square rounded overflow-hidden hover:opacity-80"
                            onClick={() => onSlideUpdate?.({ background: { type: 'image', value: `${url}?w=1600&q=80` } })}
                         >
                             <img src={`${url}?w=100&q=80`} alt="bg" className="w-full h-full object-cover" />
                         </button>
                     ))}
                 </div>
               </div>

               <div className="space-y-2 pt-2">
                 <span className="text-sm text-slate-600">Custom Color</span>
                 <div className="flex items-center gap-2 border p-2 rounded">
                    <input 
                      type="color" 
                      value={currentSlide?.background?.value?.startsWith('#') ? currentSlide.background.value : '#ffffff'}
                      onChange={(e) => onSlideUpdate?.({ background: { type: 'solid', value: e.target.value } })}
                      className="w-8 h-8 rounded cursor-pointer border-none p-0"
                    />
                    <span className="text-xs font-mono text-slate-500">
                        {currentSlide?.background?.value || '#ffffff'}
                    </span>
                 </div>
               </div>
             </section>
         </div>
      </aside>
    );
  }

  // For multi-selection, we might want to edit common props, but for MVP let's focus on single major selection
  const primaryId = selection[0];
  const element = elements.find(el => el.id === primaryId);

  if (!element) return null;

  return (
    <aside className="w-80 bg-white border-l h-full overflow-y-auto custom-scroll">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2 capitalize">
            {element.type} Properties
            </h3>
        </div>
        
        {/* Arrange Actions */}
        <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => onLayerAction('front')}>
                To Front
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => onLayerAction('back')}>
                To Back
            </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Layout Section */}
        <section className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Layout</label>
          <div className="grid grid-cols-2 gap-2">
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-100">
               <span className="text-xs text-slate-500 w-4">X</span>
               <input 
                 type="number" 
                 value={Math.round(element.x)} 
                 onChange={(e) => onUpdate(element.id, { x: Number(e.target.value) })}
                 className="w-full bg-transparent text-sm focus:outline-none"
               />
             </div>
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-100">
               <span className="text-xs text-slate-500 w-4">Y</span>
               <input 
                 type="number" 
                 value={Math.round(element.y)} 
                 onChange={(e) => onUpdate(element.id, { y: Number(e.target.value) })}
                 className="w-full bg-transparent text-sm focus:outline-none"
               />
             </div>
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-100">
               <span className="text-xs text-slate-500 w-4">W</span>
               <input 
                 type="number" 
                 value={Math.round(element.w)} 
                 onChange={(e) => onUpdate(element.id, { w: Number(e.target.value) })}
                 className="w-full bg-transparent text-sm focus:outline-none"
               />
             </div>
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border border-slate-100">
               <span className="text-xs text-slate-500 w-4">H</span>
               <input 
                 type="number" 
                 value={Math.round(element.h)} 
                 onChange={(e) => onUpdate(element.id, { h: Number(e.target.value) })}
                 className="w-full bg-transparent text-sm focus:outline-none"
               />
             </div>
          </div>
        </section>

        {/* Text Style Section */}
        {element.type === 'text' && (
          <section className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Typography</label>
            
            {/* Font Family */}
            <select 
              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-md text-sm"
              value={element.style?.fontFamily || 'Inter'}
              onChange={(e) => onUpdate(element.id, { style: { ...element.style, fontFamily: e.target.value } })}
            >
              <option value="Inter">Inter</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Comic Sans MS">Comic Sans</option>
            </select>

            {/* Font Size & Weight */}
            <div className="flex gap-2">
                 <input 
                   type="number" 
                   value={element.style?.fontSize || 16} 
                   onChange={(e) => onUpdate(element.id, { style: { ...element.style, fontSize: Number(e.target.value) } })}
                   className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-md text-sm"
                 />
                 <select 
                   className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-md text-sm"
                   value={element.style?.fontWeight || '400'}
                   onChange={(e) => onUpdate(element.id, { style: { ...element.style, fontWeight: e.target.value } })}
                 >
                    <option value="100">Thin</option>
                    <option value="400">Regular</option>
                    <option value="700">Bold</option>
                    <option value="900">Black</option>
                 </select>
            </div>

            {/* Formatting Buttons */}
            <div className="flex gap-1">
               <Button 
                 variant={element.style?.textAlign === 'left' ? 'secondary' : 'ghost'} 
                 size="sm" className="h-8 w-8 p-0"
                 onClick={() => onUpdate(element.id, { style: { ...element.style, textAlign: 'left' } })}
               >
                 <AlignLeft className="w-4 h-4" />
               </Button>
               <Button 
                 variant={element.style?.textAlign === 'center' ? 'secondary' : 'ghost'} 
                 size="sm" className="h-8 w-8 p-0"
                 onClick={() => onUpdate(element.id, { style: { ...element.style, textAlign: 'center' } })}
               >
                 <AlignCenter className="w-4 h-4" />
               </Button>
               <Button 
                 variant={element.style?.textAlign === 'right' ? 'secondary' : 'ghost'} 
                 size="sm" className="h-8 w-8 p-0"
                 onClick={() => onUpdate(element.id, { style: { ...element.style, textAlign: 'right' } })}
               >
                 <AlignRight className="w-4 h-4" />
               </Button>
               <div className="w-px h-6 bg-slate-200 mx-1" />
               <input 
                 type="color" 
                 value={element.style?.color || '#000000'}
                 onChange={(e) => onUpdate(element.id, { style: { ...element.style, color: e.target.value } })}
                 className="w-8 h-8 rounded cursor-pointer border-none"
               />
            </div>
          </section>
        )}

        {/* Appearance Section (Fill, Opacity, Radius) */}
        <section className="space-y-4 border-t pt-4">
           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Appearance</label>
           
           {/* Fill Control */}
           <div className="space-y-2">
              <span className="text-sm text-slate-600 font-medium">Fill</span>
              
              <div className="flex bg-slate-100 p-1 rounded-md">
                  <button 
                      onClick={() => onUpdate(element.id, { style: { ...element.style, fillType: 'solid', backgroundImage: 'none' } })}
                      className={cn("flex-1 text-xs py-1 rounded", (!element.style?.fillType || element.style?.fillType === 'solid') ? "bg-white shadow text-indigo-600" : "text-slate-500")}
                  >
                      Solid
                  </button>
                  <button 
                      onClick={() => onUpdate(element.id, { style: { ...element.style, fillType: 'gradient', backgroundColor: 'transparent', backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' } })}
                      className={cn("flex-1 text-xs py-1 rounded", element.style?.fillType === 'gradient' ? "bg-white shadow text-indigo-600" : "text-slate-500")}
                  >
                      Gradient
                  </button>
              </div>

              {(!element.style?.fillType || element.style?.fillType === 'solid') ? (
                  <div className="flex items-center justify-between border p-2 rounded-md">
                    <span className="text-xs text-slate-500">Color</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono">{element.style?.backgroundColor || '#ffffff'}</span>
                        <input 
                        type="color" 
                        value={element.style?.backgroundColor || '#ffffff'}
                        onChange={(e) => onUpdate(element.id, { style: { ...element.style, backgroundColor: e.target.value, backgroundImage: 'none', fillType: 'solid' } })}
                        className="w-6 h-6 rounded cursor-pointer border-none p-0 overflow-hidden"
                        />
                    </div>
                  </div>
              ) : (
                  <div className="space-y-2">
                      <div className="text-xs text-slate-400">Gradient Presets</div>
                      <div className="grid grid-cols-5 gap-1">
                          {[
                              'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Indigo-Purple
                              'linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%)', // Blue-Teal
                              'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)', // Rose-Amber
                              'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // Slate-Dark
                              'linear-gradient(135deg, #ffedd5 0%, #e0e7ff 100%)', // Warm-Cold Light
                          ].map((grad, i) => (
                              <button 
                                key={i}
                                className="w-full aspect-square rounded border hover:scale-110 transition-transform"
                                style={{ background: grad }}
                                onClick={() => onUpdate(element.id, { style: { ...element.style, backgroundImage: grad } })}
                              />
                          ))}
                      </div>
                  </div>
              )}
           </div>
              
            <div className="flex items-center justify-between pt-2">
                 <span className="text-sm text-slate-600">Opacity</span>
                 <input 
                   type="range" min="0" max="1" step="0.1"
                   value={element.style?.opacity ?? 1}
                   onChange={(e) => onUpdate(element.id, { style: { ...element.style, opacity: Number(e.target.value) } })}
                   className="w-24"
                 />
            </div>

            <div className="flex items-center justify-between pt-2">
                 <span className="text-sm text-slate-600">Radius</span>
                 <input 
                   type="range" min="0" max="100"
                   value={parseInt(String(element.style?.borderRadius || '0'))}
                   onChange={(e) => onUpdate(element.id, { style: { ...element.style, borderRadius: `${e.target.value}px` } })}
                   className="w-24"
                 />
            </div>
            
            {/* Shape Presets */}
            {element.type === 'shape' && (
                <div className="pt-2">
                    <span className="text-sm text-slate-600">Quick Shape</span>
                    <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => onUpdate(element.id, { style: { ...element.style, borderRadius: '0px' } })}>
                           <Square className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => onUpdate(element.id, { style: { ...element.style, borderRadius: '12px' } })}>
                           <div className="w-3 h-3 border rounded-sm" />
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => onUpdate(element.id, { style: { ...element.style, borderRadius: '9999px' } })}>
                           <div className="w-3 h-3 border rounded-full" />
                        </Button>
                    </div>
                </div>
            )}
        </section>

        {/* Animation Section */}
        <section className="space-y-4 border-t pt-4">
           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Animation</label>
           <div className="space-y-3">
               <div>
                   <span className="text-sm text-slate-600 block mb-1">Entry Effect</span>
                   <select 
                       className="w-full p-2 bg-slate-50 border border-slate-100 rounded-md text-sm"
                       value={element.animation?.type || 'none'}
                       onChange={(e) => onUpdate(element.id, { 
                           animation: { 
                               type: e.target.value as any, 
                               duration: element.animation?.duration || 0.5,
                               delay: element.animation?.delay || 0 
                           } 
                       })}
                   >
                       <option value="none">None</option>
                       <option value="fade-in">Fade In</option>
                       <option value="slide-up">Slide Up</option>
                       <option value="slide-down">Slide Down</option>
                       <option value="slide-left">Slide Left</option>
                       <option value="slide-right">Slide Right</option>
                       <option value="scale-up">Scale Up</option>
                       <option value="pop">Pop</option>
                   </select>
               </div>
               
               {element.animation && element.animation.type !== 'none' && (
                   <div className="grid grid-cols-2 gap-2">
                       <div>
                           <span className="text-xs text-slate-500 block mb-1">Duration (s)</span>
                           <input 
                             type="number" step="0.1" min="0.1" max="5"
                             value={element.animation.duration}
                             onChange={(e) => onUpdate(element.id, { animation: { ...element.animation!, duration: Number(e.target.value) } })}
                             className="w-full p-1 bg-slate-50 border border-slate-100 rounded text-sm"
                           />
                       </div>
                       <div>
                           <span className="text-xs text-slate-500 block mb-1">Delay (s)</span>
                           <input 
                             type="number" step="0.1" min="0" max="5"
                             value={element.animation.delay}
                             onChange={(e) => onUpdate(element.id, { animation: { ...element.animation!, delay: Number(e.target.value) } })}
                             className="w-full p-1 bg-slate-50 border border-slate-100 rounded text-sm"
                           />
                       </div>
                   </div>
               )}
           </div>
        </section>
      </div>
    </aside>
  );
}
