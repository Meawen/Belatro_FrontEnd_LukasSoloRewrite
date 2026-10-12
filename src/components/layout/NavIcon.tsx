import { PixelIcon, type IconName } from '../ui';

/** A nav item's pixel icon in an 18×18 box: the icons differ in size, the labels beside or under them line up. */
export function NavIcon({ name }: { name: IconName }) {
    return (
        <span className="flex size-[18px] shrink-0 items-center justify-center">
            <PixelIcon name={name} />
        </span>
    );
}
