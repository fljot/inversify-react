import 'reflect-metadata';
import { injectable, inject, tagged, Container } from 'inversify';

// I think that "tagged bindings" are not needed and could be better expressed with symbols!
// I think approach with symbols should cover all use-cases, yet give more semantics (documentation)
// and improve type-safety (explicit contracts ftw)... Comments? Change my mind?
// @example from https://github.com/inversify/InversifyJS/blob/master/wiki/tagged_bindings.md

interface Weapon {}

@injectable()
class Katana implements Weapon {}

@injectable()
class Shuriken implements Weapon {}

namespace NinjaModule {
    export type NotThrowableWeapon = Weapon;
    export const NotThrowableWeapon = Symbol('NotThrowableWeapon');

    export type ThrowableWeapon = Weapon;
    export const ThrowableWeapon = Symbol('ThrowableWeapon');
}

describe('better to avoid using tagged/named bindings?', () => {
    test('using tagged bindings', () => {
        const container = new Container();
        // long binding and same long @inject without explicit contract or type-check :(
        container.bind<Weapon>('Weapon').to(Katana).whenTargetTagged('canThrow', false);
        container.bind<Weapon>('Weapon').to(Shuriken).whenTargetTagged('canThrow', true);

        @injectable()
        class NinjaWithTaggedInjections {
            public constructor(
                @inject('Weapon') @tagged('canThrow', false) readonly katana: Weapon,
                @inject('Weapon') @tagged('canThrow', true) readonly shuriken: Weapon
            ) {}
        }
        const ninja = container.resolve(NinjaWithTaggedInjections);
        expect(ninja.katana instanceof Katana).toBe(true);
        expect(ninja.shuriken instanceof Shuriken).toBe(true);
    });

    test('using specific symbols instead of tagged bindings', () => {
        const container = new Container();
        // explicit and short binding and @inject :)
        // thanks to symbol and type with the same name, binding is automatically inferred as appropriate generic (<Weapon> here),
        // can also improve maintainability (because of same rules for binding and injecting)
        container.bind(NinjaModule.NotThrowableWeapon).to(Katana);
        container.bind(NinjaModule.ThrowableWeapon).to(Shuriken);

        @injectable()
        class Ninja {
            public constructor(
                @inject(NinjaModule.NotThrowableWeapon) readonly katana: Weapon, // you can still use Weapon or...
                @inject(NinjaModule.ThrowableWeapon) readonly shuriken: NinjaModule.ThrowableWeapon
                //      ^ symbol ----------- the same! ----------- type ^
            ) {}
        }

        const ninja = container.resolve(Ninja);
        expect(ninja.katana instanceof Katana).toBe(true);
        expect(ninja.shuriken instanceof Shuriken).toBe(true);
    });
});
