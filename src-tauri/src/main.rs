#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod startup_diagnostics;

fn main() {
    startup_diagnostics::initialize();
    rasavin_lib::run();
}
