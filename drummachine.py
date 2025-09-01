import gi
import math
import random
from playsound3 import playsound
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, cairo, GLib

# "User" constants
NOTES_PER_MEASURE = 16
BPM = 120
SNARE_SAMPLES = [
    "amen-drum-kit/26900__vexst__snare-1.wav",
    "amen-drum-kit/26901__vexst__snare-2.wav",
    "amen-drum-kit/26902__vexst__snare-3.wav",
    "amen-drum-kit/26903__vexst__snare-4.wav",
    ]
BASS_DRUM_SAMPLES = [
    "amen-drum-kit/26885__vexst__kick-1.wav",
    "amen-drum-kit/26886__vexst__kick-2.wav",
    "amen-drum-kit/26887__vexst__kick-3.wav",
    "amen-drum-kit/26888__vexst__kick-4.wav",
]
HIGH_HAT_SAMPLES = [
    "amen-drum-kit/26879__vexst__closed-hi-hat-1.wav",
    "amen-drum-kit/26880__vexst__closed-hi-hat-2.wav",
    "amen-drum-kit/26881__vexst__closed-hi-hat-3.wav",
    "amen-drum-kit/26882__vexst__closed-hi-hat-4.wav",
]

# Program constants
CANVAS_SIZE = int(4 ** (NOTES_PER_MEASURE // 2))
NOTE_DICT = {0: "B", 1: "S", 2: "H", 3: "-"}
DARKEST_GRIDLINE = 0.1
LIGHTEST_GRIDLINE = 0.9
BACKGROUND = 1.0
GRID_INCREMENTS = int(NOTES_PER_MEASURE // 2)
NOTE_COLORS = [
    (0.8, 0.2, 0.2),  # Bass
    (0.2, 0.8, 0.2),  # Snare
    (0.2, 0.2, 0.8),  # Hi-hat
    (0.8, 0.8, 0.2),  # Rest
]
MIN_ZOOM = 0.00001
MAX_ZOOM = 60

class PanZoomCanvas(Gtk.DrawingArea):
    def __init__(self, coord_label, measure_label):
        super().__init__()
        self.coord_label = coord_label
        self.measure_label = measure_label
        self.set_size_request(800, 600)
        self.add_events(Gdk.EventMask.BUTTON_PRESS_MASK |
                        Gdk.EventMask.BUTTON_RELEASE_MASK |
                        Gdk.EventMask.POINTER_MOTION_MASK |
                        Gdk.EventMask.SCROLL_MASK)
        self.connect("draw", self.on_draw)
        self.connect("button-press-event", self.on_button_press)
        self.connect("button-release-event", self.on_button_release)
        self.connect("motion-notify-event", self.on_mouse_move)
        self.connect("scroll-event", self.on_scroll)
        self.set_grid_start_position()

    def set_grid_start_position(self):
        self.dragging = False
        self.right_clicking = False
        self.last_mouse = (0, 0)

        # Calculate initial zoom based on CANVAS_SIZE
        # zoom = 2.0 for CANVAS_SIZE=256, zoom = 0.008 for CANVAS_SIZE=65536
        log_min_c = math.log(256)
        log_max_c = math.log(65535)
        log_c = math.log(CANVAS_SIZE)
        log_min_z = math.log(0.008)
        log_max_z = math.log(60)
        t = (log_c - log_min_c) / (log_max_c - log_min_c)
        log_zoom = log_max_z + t * (log_min_z - log_max_z)
        zoom = math.exp(log_zoom)
        self.zoom = zoom

        self.offset = [CANVAS_SIZE / 2 - (800 / 2) / self.zoom, CANVAS_SIZE / 2 - (600 / 2) / self.zoom]
        self.mouse_coords = []
        self.mouse_notes = []
        self.measure_coords = []
        self.measure_notes = []
        self.drawn_measure_notes = []
        self.queue_draw()

    def on_draw(self, widget, cr):
        self.update_labels()
        alloc = self.get_allocation()
        width, height = alloc.width, alloc.height
        
        # Set up pan and zoom (scale first, then translate in screen coords)
        cr.save()
        cr.scale(self.zoom, self.zoom)
        cr.translate(-self.offset[0], -self.offset[1])
        
        # Draw the fractal background
        cr.set_source_rgb(BACKGROUND, BACKGROUND, BACKGROUND)
        cr.rectangle(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        cr.fill()

        # Draw adaptive grid: scale in powers of 4 as you zoom out. Multiple grid depths, each lighter as grid gets smaller.
        cr.set_line_width(1.0 / self.zoom)
        grid_size = 1
        max_grid_size = CANVAS_SIZE
        grid_levels = []

        while grid_size <= max_grid_size:
            grid_levels.append(grid_size)
            grid_size *= 4
        
        n = len(grid_levels)
        for i, grid_size in enumerate(grid_levels):
            grid_spacing = grid_size * self.zoom
            if grid_spacing >= 5:
                # Interpolate color: finest grid (i=0) is LIGHTEST, coarsest (i=n-1) is DARKEST
                t = i / (n - 1) if n > 1 else 0
                color = LIGHTEST_GRIDLINE * (1 - t) + DARKEST_GRIDLINE * t

                # Only the most minor visible gridlines (smallest i with grid_spacing >= 5) fade in
                if grid_spacing < 15:
                    fade_perc = (grid_spacing - 5) / 10
                    color = color * fade_perc + BACKGROUND * (1 - fade_perc)
                    first_drawn = False

                cr.set_source_rgb(color, color, color)

                # Only draw grid lines in the visible area
                left = int(self.offset[0] // grid_size * grid_size)
                right = int(self.offset[0] + width / self.zoom) + grid_size
                top = int(self.offset[1] // grid_size * grid_size)
                bottom = int(self.offset[1] + height / self.zoom) + grid_size
                left = max(0, left)
                right = min(CANVAS_SIZE, right)
                top = max(0, top)
                bottom = min(CANVAS_SIZE, bottom)

                # Vertical lines
                for x in range(left, right, grid_size):
                    cr.move_to(x, top)
                    cr.line_to(x, bottom)
                # Horizontal lines
                for y in range(top, bottom, grid_size):
                    cr.move_to(left, y)
                    cr.line_to(right, y)
                cr.stroke()
        
        # Draw canvas / grid border
        cr.set_source_rgb(DARKEST_GRIDLINE, DARKEST_GRIDLINE, DARKEST_GRIDLINE)
        cr.set_line_width(2.0 / self.zoom)
        cr.rectangle(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        cr.stroke()
        
        # Draw all drawn notes from first (largest visible) to last (smallest visible)
        cr.set_line_width(2.0 / self.zoom)
        x0 = 0
        y0 = 0
        for i, note in enumerate(self.drawn_measure_notes):
            # Determine color, location, and size
            note_color = NOTE_COLORS[note]
            note_width = (CANVAS_SIZE / 4) // (4 ** (i // 2))
            note_height = (CANVAS_SIZE / 4) // (4 ** ((i - 1) // 2))
            if i % 2 == 0:
                x0 += note * note_width
            else:
                y0 += note * note_height

            # Draw the note box fill at 25% opacity 
            cr.set_source_rgba(*note_color, 0.25)
            cr.rectangle(x0, y0, note_width, note_height)
            cr.fill()
            
            # Draw the note box outline at 100% opacity
            cr.set_source_rgba(*note_color, 1.0)
            cr.rectangle(x0, y0, note_width, note_height)
            cr.stroke()

        cr.restore()
        return False

    def update_labels(self):
        if self.mouse_coords:
            self.coord_label.set_text(f"Mouse: ({self.mouse_coords[0]}, {self.mouse_coords[1]})  Notes: {self.mouse_notes}")
        else:
            self.coord_label.set_text("Mouse: ...")

        if self.measure_coords:
            self.measure_label.set_text(f"Selection: ({self.measure_coords[0]}, {self.measure_coords[1]})  Notes: {self.measure_notes}")
        else:
            self.measure_label.set_text("Selection: ...")

    def on_button_press(self, widget, event):
        # Left click: start dragging
        if event.button == 1:
            self.dragging = True
            self.last_mouse = (event.x, event.y)
        # Right click: save world coords and note sequence
        elif event.button == 3:
            self.right_clicking = True
            self.last_mouse = (event.x, event.y)
            self.stop_animate_fractal_beat()
        return True

    def on_button_release(self, widget, event):
        if event.button == 1:
            self.dragging = False
        elif event.button == 3:
            self.right_clicking = False
            notes = self.determine_notes_from_coords(self.mouse_coords[0], self.mouse_coords[1])
            self.measure_coords = self.mouse_coords
            self.measure_notes = notes
            self.drawn_measure_notes = []
            self.animate_fractal_beat()
        return True

    def on_mouse_move(self, widget, event):
        # Always update mouse world coordinates (invert transform: scale then translate)
        wx = (event.x / self.zoom) + self.offset[0]
        wy = (event.y / self.zoom) + self.offset[1]
        wx = max(0, min(CANVAS_SIZE - 1, wx))
        wy = max(0, min(CANVAS_SIZE - 1, wy))
        self.mouse_coords = [int(wx), int(wy)]
        self.mouse_notes = self.determine_notes_from_coords(wx, wy)

        # Update pan if dragging
        if self.dragging:
            dx = event.x - self.last_mouse[0]
            dy = event.y - self.last_mouse[1]
            self.offset[0] -= dx / self.zoom
            self.offset[1] -= dy / self.zoom
            self.last_mouse = (event.x, event.y)
            self.queue_draw()

        # Update notes if right clicking
        elif self.right_clicking:
            notes = self.determine_notes_from_coords(wx, wy)
            self.measure_coords = self.mouse_coords
            self.measure_notes = notes
            self.drawn_measure_notes = notes
            self.queue_draw()
        
        self.update_labels()

        return True

    def on_scroll(self, widget, event):
        # Zoom in/out centered on mouse
        mx, my = event.x, event.y
        # Convert mouse position to world coordinates before zoom
        world_x = (mx / self.zoom) + self.offset[0]
        world_y = (my / self.zoom) + self.offset[1]
        # Change zoom
        if event.direction == Gdk.ScrollDirection.UP:
            new_zoom = self.zoom * 1.1
        elif event.direction == Gdk.ScrollDirection.DOWN:
            new_zoom = self.zoom / 1.1
        else:
            new_zoom = self.zoom
        new_zoom = max(MIN_ZOOM, min(MAX_ZOOM, new_zoom))
        # Adjust offset so the same world coordinate stays under the mouse
        self.offset[0] = world_x - (mx / new_zoom)
        self.offset[1] = world_y - (my / new_zoom)
        self.zoom = new_zoom
        self.queue_draw()
        return True

    def on_key_press(self, widget, event):
        keyval = Gdk.keyval_name(event.keyval)

        # Clear selection and notes on 'c' key
        if keyval and keyval.lower() == 'c':
            self.measure_coords = []
            self.measure_notes = []
            self.drawn_measure_notes = []
            self.stop_animate_fractal_beat()
            self.queue_draw()

        # Animate / play fractal beat on 'p' key
        elif keyval and keyval.lower() == 'p':
            self.animate_fractal_beat()

        # Reset grid on 'r' key
        elif keyval and keyval.lower() == 'r':
            self.set_grid_start_position()

        return False

    def determine_notes_from_coords(self, x, y):
        current_notes = []
        note_size = CANVAS_SIZE // 4
        tx, ty = x, y
        while note_size > 0:
            current_notes.append(int(tx // note_size))
            current_notes.append(int(ty // note_size))
            tx = tx % note_size
            ty = ty % note_size
            note_size = int(note_size // 4)
        return current_notes

    def note_list_to_string(self, notes):
        output = ""
        for note in notes:
            output += f"{NOTE_DICT.get(note, '?')}"
        return output.strip()

    def animate_fractal_beat(self):
        # Animate the fractal beat by updating the drawn measure notes one at a time
        self.drawn_measure_notes = []
        if not self.measure_notes:
            return
        self._animate_index = 0

        def add_next_note():
            if self._animate_index < len(self.measure_notes):
                note = self.measure_notes[self._animate_index]
                self.drawn_measure_notes.append(note)
                self.play_sound(note)
                
                self._animate_index += 1
                self.queue_draw()
                return True
            else:
                self._animate_timeout_id = None
                return False  # Stop timeout

        # Stop any previous animation
        self.stop_animate_fractal_beat()
        # Start the animation with BPM interval
        note_delay = (60000 / (NOTES_PER_MEASURE / 4)) // BPM
        self._animate_timeout_id = GLib.timeout_add(note_delay, add_next_note)

    def stop_animate_fractal_beat(self):
        # Stop the fractal beat animation if running
        if hasattr(self, '_animate_timeout_id') and self._animate_timeout_id is not None:
            GLib.source_remove(self._animate_timeout_id)
            self._animate_timeout_id = None

    def play_sound(self, note):
        match note:
            case 0:
                playsound(BASS_DRUM_SAMPLES[random.randint(0, len(BASS_DRUM_SAMPLES) - 1)], block=False)
            case 1:
                playsound(SNARE_SAMPLES[random.randint(0, len(SNARE_SAMPLES) - 1)], block=False)
            case 2:
                playsound(HIGH_HAT_SAMPLES[random.randint(0, len(HIGH_HAT_SAMPLES) - 1)], block=False)

class MyWindow(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Fractal drum machine")
        self.set_border_width(10)
        self.set_default_size(900, 700)
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(vbox)
        self.coord_label = Gtk.Label(label="World: (0, 0)")
        vbox.pack_start(self.coord_label, False, False, 0)
        self.measure_label = Gtk.Label(label="")
        vbox.pack_start(self.measure_label, False, False, 0)
        self.canvas = PanZoomCanvas(self.coord_label, self.measure_label)
        vbox.pack_start(self.canvas, True, True, 0)
        # Connect key-press-event to canvas
        self.canvas.set_can_focus(True)
        self.canvas.grab_focus()
        self.canvas.connect("key-press-event", self.canvas.on_key_press)

win = MyWindow()
win.connect("destroy", Gtk.main_quit)
win.show_all()
Gtk.main()
